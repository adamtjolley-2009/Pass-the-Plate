import Anthropic from 'npm:@anthropic-ai/sdk@0.137.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { extractJsonLdRecipe, htmlToText, normalizeAiRecipe, parseAiJson } from './recipe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// `code` lets the app react, e.g. offer "paste the recipe text" when a site blocks us
const fail = (error: string, status: number, code?: 'blocked' | 'no_recipe') =>
  json({ success: false, error, code }, status);

// Claude reads the page text when a site has no structured recipe data.
// Set the ANTHROPIC_API_KEY secret in Supabase to enable it.
// Trim stray whitespace or quotes that sneak in when the secret is pasted
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim().replace(/^["']|["']$/g, '');
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey, timeout: 60_000, maxRetries: 1 }) : null;

const AI_SYSTEM = `You extract recipes from web page text or from photos of recipe cards, cookbook pages and handwritten notes.
Copy the recipe as written: each ingredient line with its quantity and unit (e.g. "400 g spaghetti"), and each step in order.
Use times like "10 min" or "1 hr 15 min". Set servings to 0 if the page doesn't say.
Pick the category from: Breakfast, Lunch, Dinner, Appetizers, Desserts, or "" if none fits.
Only include substitutes the page itself suggests.
Read handwriting carefully and give your best reading of unclear words. If a photo has no title, make a short one from the dish.
If there is no recipe, return an empty title and no ingredients.`;

// Photos the app may send (it shrinks them to JPEG first)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024;

// Structured output: the response is guaranteed to match this shape
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    prepTime: { type: 'string' },
    cookTime: { type: 'string' },
    servings: { type: 'integer' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    substitutes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { original: { type: 'string' }, replacement: { type: 'string' } },
        required: ['original', 'replacement'],
        additionalProperties: false,
      },
    },
    category: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Appetizers', 'Desserts', ''] },
  },
  required: ['title', 'description', 'prepTime', 'cookTime', 'servings', 'ingredients', 'steps', 'substitutes', 'category'],
  additionalProperties: false,
};

// Claude Haiku 5.5 prices in USD per token (prompts under 100K tokens)
const HAIKU_INPUT_USD = 0.1 / 1_000_000;
const HAIKU_OUTPUT_USD = 0.5 / 1_000_000;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();

// Adds this request's cost to the running total and emails once when it passes
// the alert threshold. Never fails the import.
async function recordSpend(usage: Anthropic.Usage): Promise<void> {
  if (!admin) return;
  try {
    const cost = usage.input_tokens * HAIKU_INPUT_USD + usage.output_tokens * HAIKU_OUTPUT_USD;
    const { data, error } = await admin.rpc('record_ai_spend', { cost_usd: cost });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.should_alert) return;

    const total = Number(row.total_usd).toFixed(2);
    console.log(`AI spend passed $${row.alert_threshold_usd}: now $${total}`);
    if (!resendKey || !row.alert_email) {
      console.error('Spend alert not sent: RESEND_API_KEY or alert email is missing');
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Pass the Plate <onboarding@resend.dev>',
        to: [row.alert_email],
        subject: `Pass the Plate: recipe import AI spend passed $${row.alert_threshold_usd}`,
        text:
          `The recipe importer's Claude API usage has reached about $${total} ` +
          `(alert threshold: $${row.alert_threshold_usd}).\n\n` +
          `Check your balance at https://console.anthropic.com/settings/billing\n` +
          `This is a one-time alert.`,
      }),
    });
    if (!res.ok) console.error('Spend alert email failed:', res.status, await res.text());
  } catch (error) {
    console.error('Recording AI spend failed:', error);
  }
}

type RecipeInput =
  | { kind: 'page'; text: string; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'photos'; images: { data: string; mediaType: ImageType }[] };

const NOT_FOUND: Record<RecipeInput['kind'], string> = {
  page: "Couldn't find a recipe on that page.",
  text: "Couldn't find a recipe in that text.",
  photos: "Couldn't read a recipe from that photo. Try a closer, well-lit shot.",
};

function claudeContent(input: RecipeInput): Anthropic.MessageParam['content'] {
  if (input.kind === 'page') return `Page: ${input.url}\n\n${input.text}`;
  if (input.kind === 'text') return input.text;
  return [
    ...input.images.map((image): Anthropic.ImageBlockParam => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.data },
    })),
    { type: 'text', text: 'Extract the recipe from these photos. They may be the front and back of one card.' },
  ];
}

// Asks Claude to pull the recipe out of page text (fetched by us, or pasted by the user) or photos
async function readWithClaude(input: RecipeInput): Promise<Response> {
  if (!anthropic) {
    console.error('ANTHROPIC_API_KEY is not set; skipping AI fallback');
    return input.kind === 'page'
      ? fail(NOT_FOUND.page, 422, 'no_recipe')
      : fail("Reading recipes isn't set up yet. Add the Anthropic API key in Supabase.", 500);
  }

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 16000,
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: claudeContent(input) }],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RECIPE_SCHEMA },
      },
    });
  } catch (error) {
    console.error('Claude API error:', error);
    if (error instanceof Anthropic.RateLimitError) {
      return fail('Too many imports right now. Please try again in a minute.', 429);
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return fail("Recipe import isn't set up correctly. Check the Anthropic API key in Supabase.", 500);
    }
    return fail('The recipe reader is having trouble right now. Please try again.', 502);
  }
  await recordSpend(response.usage);

  if (response.stop_reason === 'refusal') {
    console.error('Claude declined:', response.stop_details);
    return fail(NOT_FOUND[input.kind], 422, 'no_recipe');
  }
  const content = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  const parsed = parseAiJson(content);
  const recipe = parsed ? normalizeAiRecipe(parsed) : null;
  if (!recipe) {
    console.error('Unusable AI response:', response.stop_reason, content.slice(0, 500));
    return fail(NOT_FOUND[input.kind], 422, 'no_recipe');
  }

  return json({ success: true, recipe, source: 'ai' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, text, images } = await req.json().catch(() => ({}));

    // Photos of a recipe card or cookbook page, as base64
    if (Array.isArray(images)) {
      const valid = images.every(
        (image) =>
          typeof image?.data === 'string' &&
          image.data.length > 0 &&
          image.data.length <= MAX_IMAGE_BASE64 &&
          IMAGE_TYPES.includes(image.mediaType),
      );
      if (!valid || images.length === 0 || images.length > MAX_IMAGES) {
        return fail(`Add 1 to ${MAX_IMAGES} photos (JPEG or PNG, under 5 MB each).`, 400);
      }
      return await readWithClaude({ kind: 'photos', images });
    }

    // Recipe text the user copied from a page we couldn't fetch
    if (typeof text === 'string') {
      const pageText = text.trim().slice(0, 30000);
      if (pageText.length < 50) {
        return fail('Paste the whole recipe, including the ingredients and steps.', 400);
      }
      return await readWithClaude({ kind: 'text', text: pageText });
    }

    let parsedUrl: URL | null = null;
    try {
      parsedUrl = typeof url === 'string' ? new URL(url.trim()) : null;
    } catch {
      parsedUrl = null;
    }
    if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
      return fail('Please enter a full web address starting with https://', 400);
    }

    let pageRes: Response;
    try {
      pageRes = await fetch(parsedUrl, {
        headers: {
          // Many recipe sites refuse requests that don't look like a browser
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error('Fetch error:', error);
      return fail("Couldn't reach that website. Check the link and try again.", 502);
    }

    if (pageRes.status === 401 || pageRes.status === 403 || pageRes.status === 429) {
      console.error('Blocked by site:', parsedUrl.hostname, pageRes.status);
      return fail("That website doesn't allow automatic imports. Paste the recipe text instead.", 502, 'blocked');
    }
    if (!pageRes.ok) {
      return fail(`That page couldn't be loaded (error ${pageRes.status}). Check the link and try again.`, 502);
    }

    const html = await pageRes.text();

    // Most recipe sites include structured recipe data; use it when present
    const structured = extractJsonLdRecipe(html);
    if (structured) {
      return json({ success: true, recipe: structured, source: 'structured-data' });
    }

    // Otherwise ask Claude to read the page text
    const pageText = htmlToText(html).slice(0, 30000);
    if (pageText.length < 100) {
      return fail("Couldn't find a recipe on that page.", 422, 'no_recipe');
    }
    return await readWithClaude({ kind: 'page', text: pageText, url: parsedUrl.href });
  } catch (error) {
    console.error('Parse error:', error);
    return fail('Something went wrong importing that recipe. Please try again.', 500);
  }
});
