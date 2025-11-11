// Get current Telegram chat member count
// Public function (no JWT) returning { count: number }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      return new Response(
        JSON.stringify({ error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept POST (invoke) or GET, ignore body for now
    const apiUrl = `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`;
    const tgRes = await fetch(apiUrl, { method: 'GET' });
    const tgJson = await tgRes.json();

    if (!tgRes.ok || !tgJson?.ok) {
      console.error('Telegram API error:', tgJson);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch member count from Telegram', details: tgJson }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const count = tgJson.result as number;

    return new Response(
      JSON.stringify({ success: true, count }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('get-chat-member-count error:', e);
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
