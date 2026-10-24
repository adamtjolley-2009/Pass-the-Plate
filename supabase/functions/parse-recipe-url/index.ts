import Anthropic from 'npm:@anthropic-ai/sdk@0.137.0';
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

const AI_SYSTEM = `You extract recipes from the text of a web page.
Copy the recipe as written: each ingredient line with its quantity and unit (e.g. "400 g spaghetti"), and each step in order.
Use times like "10 min" or "1 hr 15 min". Set servings to 0 if the page doesn't say.
Pick the category from: Breakfast, Lunch, Dinner, Appetizers, Desserts, or "" if none fits.
Only include substitutes the page itself suggests.
If the page has no recipe, return an empty title and no ingredients.`;

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

// Asks Claude to pull the recipe out of page text (fetched by us, or pasted by the user)
async function readWithClaude(pageText: string, source?: string): Promise<Response> {
  if (!anthropic) {
    console.error('ANTHROPIC_API_KEY is not set; skipping AI fallback');
    return source
      ? fail("Couldn't find a recipe on that page.", 422, 'no_recipe')
      : fail("Reading pasted recipes isn't set up yet. Add the Anthropic API key in Supabase.", 500);
  }

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 16000,
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: source ? `Page: ${source}\n\n${pageText}` : pageText }],
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

  if (response.stop_reason === 'refusal') {
    console.error('Claude declined:', response.stop_details);
    return fail("Couldn't find a recipe on that page.", 422, 'no_recipe');
  }
  const content = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  const parsed = parseAiJson(content);
  const recipe = parsed ? normalizeAiRecipe(parsed) : null;
  if (!recipe) {
    console.error('Unusable AI response:', response.stop_reason, content.slice(0, 500));
    return fail("Couldn't find a recipe in that text.", 422, 'no_recipe');
  }

  return json({ success: true, recipe, source: 'ai' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, text } = await req.json().catch(() => ({}));

    // Recipe text the user copied from a page we couldn't fetch
    if (typeof text === 'string') {
      const pageText = text.trim().slice(0, 30000);
      if (pageText.length < 50) {
        return fail('Paste the whole recipe, including the ingredients and steps.', 400);
      }
      return await readWithClaude(pageText);
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
    return await readWithClaude(pageText, parsedUrl.href);
  } catch (error) {
    console.error('Parse error:', error);
    return fail('Something went wrong importing that recipe. Please try again.', 500);
  }
});
