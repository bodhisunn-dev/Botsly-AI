import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!telegramBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get chat_id from messages table
    const { data: chatData, error: chatError } = await supabase
      .from('messages')
      .select('chat_id')
      .limit(1)
      .single();

    if (chatError || !chatData) {
      console.error('Error fetching chat_id:', chatError);
      throw new Error('Could not fetch chat_id');
    }

    const chatId = chatData.chat_id;

    // Calculate timestamp for 12 hours ago
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    // Get top 10 most active users from last 12 hours (excluding High_ju and JR28X)
    const { data: activeUsers, error: usersError } = await supabase
      .from('telegram_users')
      .select('username, first_name, telegram_id')
      .gte('last_active_at', twelveHoursAgo)
      .not('username', 'in', '("High_ju","JR28X")')
      .not('username', 'is', null)
      .order('message_count', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('Error fetching active users:', usersError);
      throw new Error('Failed to fetch active users');
    }

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active users found in the last 12 hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Random degen messages from Memetropolis.ai team
    const messages = [
      "🚀 Yo legends! The Memetropolis.ai squad sees you grinding hard! These absolute chads have been killing it the last 12 hours:",
      "👀 Memetropolis.ai here checking in! Big ups to our most active degens crushing it today. Y'all are built different:",
      "💎 The Memetropolis.ai team salutes these absolute warriors! Been watching you dominate the chat for 12 hours straight:",
      "🔥 Damn fam! Memetropolis.ai crew noticed these legends never sleep. Most active members right here:",
      "⚡ Shoutout from the Memetropolis.ai team! These degens are carrying the entire vibe. Top performers last 12h:",
      "🎯 Memetropolis.ai checking in - you beautiful degenerates have been going CRAZY! Top activity warriors:",
      "💪 The Memetropolis.ai squad is impressed! These absolute units haven't touched grass in 12 hours (respect):",
      "🌟 Ayo! Memetropolis.ai team here with mad respect for our most active legends. Y'all are insane:",
      "🚨 Memetropolis.ai alert! These gigachads have been popping off non-stop. Most active degens of the day:",
      "🎊 Big love from the Memetropolis.ai crew! Our top performers making this place legendary:"
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Create mentions string
    const mentions = activeUsers
      .map(user => `@${user.username}`)
      .join(' ');

    const fullMessage = `${randomMessage}\n\n${mentions}\n\nKeep being awesome! 🚀💯`;

    // Send message to Telegram
    await sendTelegramMessage(chatId, fullMessage, telegramBotToken);

    console.log(`Sent shoutout to ${activeUsers.length} active users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Top active users shoutout sent',
        userCount: activeUsers.length,
        users: activeUsers.map(u => u.username)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in top-active-shoutout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function sendTelegramMessage(chatId: number, text: string, botToken: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Telegram API error:', error);
    throw new Error(`Failed to send message: ${error}`);
  }

  return response.json();
}
