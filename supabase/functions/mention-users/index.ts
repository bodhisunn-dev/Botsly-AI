import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current mention index from bot_state
    const { data: stateData } = await supabase
      .from('bot_state')
      .select('value')
      .eq('id', 'mention_index')
      .maybeSingle();

    const currentIndex = stateData?.value ? parseInt(stateData.value) : 0;

    // Get all users ordered by last_active_at ASC (least active first), excluding High_ju and JR28X
    const { data: allUsers, error: usersError } = await supabase
      .from('telegram_users')
      .select('telegram_id, username, first_name, last_name')
      .not('username', 'in', '("High_ju","JR28X")')
      .order('last_active_at', { ascending: true });

    if (usersError) {
      throw usersError;
    }

    if (!allUsers || allUsers.length === 0) {
      console.log('No users to mention');
      return new Response(
        JSON.stringify({ success: true, message: 'No users to mention' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Select batch of 10 users starting from currentIndex
    const batchSize = 10;
    const batch = allUsers.slice(currentIndex, currentIndex + batchSize);
    
    // Calculate next index
    const nextIndex = (currentIndex + batchSize) >= allUsers.length ? 0 : currentIndex + batchSize;

    // Update the mention index
    await supabase
      .from('bot_state')
      .upsert({ 
        id: 'mention_index', 
        value: nextIndex.toString(), 
        updated_at: new Date().toISOString() 
      });

    // Create mentions string - use markdown links for users without usernames
    const mentions = batch
      .map(user => {
        if (user.username) {
          return `@${user.username}`;
        }
        // For users without username, use markdown mention with telegram_id
        const name = user.first_name || user.last_name || 'User';
        return `[${name}](tg://user?id=${user.telegram_id})`;
      })
      .join(' ');

    const motivationalMessages = [
      `🔥 Rise and grind, legends! ${mentions}`,
      `💎 Time to shine! ${mentions}`,
      `⚡️ Let's get active! ${mentions}`,
      `🚀 WAGMI! ${mentions}`,
      `🎯 Stay engaged, degens! ${mentions}`,
      `💪 Keep the energy up! ${mentions}`,
      `🌟 Your presence matters! ${mentions}`,
      `🔔 Don't miss out on the action! ${mentions}`,
      `👀 Eyes on the chat! ${mentions}`,
      `🎪 Join the conversation! ${mentions}`
    ];

    const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    // Send message to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        }),
      }
    );

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json();
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }

    const result = await telegramResponse.json();
    console.log('Mentioned users successfully:', { 
      batchSize: batch.length, 
      currentIndex, 
      nextIndex,
      totalUsers: allUsers.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        mentioned: batch.length,
        progress: `${currentIndex + batch.length}/${allUsers.length}`,
        nextIndex
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mention-users:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
