import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const TestConsolidateXPosts = () => {
  const [isPosting, setIsPosting] = useState(false);

  const handleTestPost = async () => {
    setIsPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke('consolidate-x-posts');
      
      if (error) {
        throw error;
      }

      console.log('Consolidate X posts response:', data);
      
      if (data.postsCount > 0) {
        toast.success(`Posted summary of ${data.postsCount} X.com post${data.postsCount !== 1 ? 's' : ''} to Telegram! 🐦`);
      } else {
        toast.info('No X.com posts found in the last 24 hours');
      }
    } catch (error) {
      console.error('Error consolidating X posts:', error);
      toast.error('Failed to consolidate X.com posts');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test X.com Posts Consolidation</CardTitle>
        <CardDescription>
          Consolidate all X.com/Twitter links shared in the last 24 hours into one Telegram message (scheduled every 12 hours)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleTestPost} 
          disabled={isPosting}
          className="w-full"
        >
          {isPosting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Consolidating...
            </>
          ) : (
            'Send Consolidation Now'
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Collects all X.com/Twitter links from messages in the last 24 hours and posts a summary to Telegram
        </p>
      </CardContent>
    </Card>
  );
};
