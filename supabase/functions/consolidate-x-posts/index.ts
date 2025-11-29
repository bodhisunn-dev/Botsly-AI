import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting X.com posts consolidation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatIdStr = Deno.env.get('TELEGRAM_CHAT_ID');
    
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    
    if (!chatIdStr) {
      throw new Error('TELEGRAM_CHAT_ID not configured');
    }
    
    const chatId = parseInt(chatIdStr);
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get messages from last 24 hours containing x.com or twitter.com links
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        message_text,
        created_at,
        telegram_user_id,
        telegram_users!inner(username, first_name, last_name)
      `)
      .gte('created_at', last24Hours)
      .or('message_text.ilike.%x.com%,message_text.ilike.%twitter.com%')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
    
    console.log(`Found ${messages?.length || 0} messages with X.com links`);
    
    if (!messages || messages.length === 0) {
      console.log('No X.com posts found in the last 24 hours');
      return new Response(JSON.stringify({ ok: true, message: 'No X.com posts found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Extract X.com links and format the message
    const postsData = messages.map(msg => {
      const urls = extractUrls(msg.message_text);
      const xUrls = urls.filter(url => url.includes('x.com') || url.includes('twitter.com'));
      const user = msg.telegram_users as any;
      const displayName = user.username ? `@${user.username}` : user.first_name || 'Unknown';
      
      // Get a snippet of the message (first 100 chars, excluding the URL)
      let snippet = msg.message_text;
      xUrls.forEach(url => {
        snippet = snippet.replace(url, '').trim();
      });
      snippet = snippet.length > 100 ? snippet.substring(0, 100) + '...' : snippet;
      
      return {
        user: displayName,
        snippet,
        urls: xUrls,
        timestamp: new Date(msg.created_at).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    }).filter(post => post.urls.length > 0);
    
    if (postsData.length === 0) {
      console.log('No valid X.com links found');
      return new Response(JSON.stringify({ ok: true, message: 'No valid X.com links found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Build the consolidated message
    let consolidatedMessage = '🐦 *X.com Posts from the Last 24 Hours*\n\n';
    consolidatedMessage += `Found ${postsData.length} post${postsData.length !== 1 ? 's' : ''} shared by the community:\n\n`;
    
    postsData.forEach((post, index) => {
      consolidatedMessage += `${index + 1}. *${post.user}* (${post.timestamp})\n`;
      if (post.snippet) {
        consolidatedMessage += `   _"${post.snippet}"_\n`;
      }
      post.urls.forEach(url => {
        consolidatedMessage += `   🔗 ${url}\n`;
      });
      consolidatedMessage += '\n';
    });
    
    consolidatedMessage += '---\n_This is an automated summary posted every 12 hours_ 📊';
    
    console.log('Sending consolidated message to Telegram...');
    
    // Send to Telegram
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: consolidatedMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Telegram API error:', result);
      throw new Error(`Telegram API error: ${JSON.stringify(result)}`);
    }
    
    console.log('Consolidated X.com posts sent successfully');
    
    return new Response(JSON.stringify({ 
      ok: true, 
      postsCount: postsData.length,
      message: 'Consolidated X.com posts sent successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in consolidate-x-posts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}
