import { useState, useEffect } from "react";
import { Activity, MessageSquare, Users, TrendingUp, Bot, Sparkles, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import MetricCard from "@/components/MetricCard";
import UserLeaderboard from "@/components/UserLeaderboard";
import RecentMessages from "@/components/RecentMessages";
import BotConfig from "@/components/BotConfig";
import { Auth } from "@/components/Auth";
import { AdminManagement } from "@/components/AdminManagement";
import { TestMemetropolisPost } from "@/components/TestMemetropolisPost";
import { UploadMemetropolisVideo } from "@/components/UploadMemetropolisVideo";
import { TestRandomFactPost } from "@/components/TestRandomFactPost";
import { TestDailyGM } from "@/components/TestDailyGM";
import { TestTopActiveShoutout } from "@/components/TestTopActiveShoutout";
import { TestUserMentions } from "@/components/TestUserMentions";
import { BulkUserImport } from "@/components/BulkUserImport";
import { TestBotslyMemePost } from "@/components/TestBotslyMemePost";
import { TestConsolidateXPosts } from "@/components/TestConsolidateXPosts";
import { OnlineUsersTracker } from "@/components/OnlineUsersTracker";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const {
    data: metrics,
    isLoading
  } = useDashboardMetrics();
  const {
    toast
  } = useToast();
  useEffect(() => {
    const checkAdminStatus = async (userId: string) => {
      const {
        data,
        error
      } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
      setIsAdmin(!!data && !error);
    };
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      if (session?.user?.id) {
        checkAdminStatus(session.user.id);
      }
      setLoading(false);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
  };
  if (loading || session && isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Bot className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>;
  }
  if (!session) {
    return <Auth />;
  }
  if (isAdmin === false) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md border-border">
          <CardHeader className="text-center">
            <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your account does not have admin privileges to access this dashboard.
            </p>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Bot className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Botsly AI Bot Dashboard</h1>
                  <p className="text-muted-foreground">Monitor and control your AI-powered Telegram bot</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Total Users" value={isLoading ? "..." : metrics?.totalUsers.toString() || "0"} change="Real-time" icon={Users} trend="up" />
                <MetricCard title="Messages Today" value={isLoading ? "..." : metrics?.messagesToday.toString() || "0"} change="Real-time" icon={MessageSquare} trend="up" />
                <MetricCard title="Active Conversations" value={isLoading ? "..." : metrics?.activeConversations.toString() || "0"} change="Last 24h" icon={Activity} trend="up" />
                <MetricCard title="Images Generated" value={isLoading ? "..." : metrics?.imagesGenerated.toString() || "0"} change="All time" icon={Sparkles} trend="up" />
              </div>

              {/* Activity Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border bg-gradient-to-br from-card to-card/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Top Active Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserLeaderboard />
                  </CardContent>
                </Card>

                <Card className="border-border bg-gradient-to-br from-card to-card/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-accent" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecentMessages />
                  </CardContent>
                </Card>
              </div>

              {/* Online/Offline Users */}
              <OnlineUsersTracker />
            </TabsContent>

            <TabsContent value="users">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserLeaderboard expanded />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Message History</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentMessages expanded />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config">
              <div className="space-y-6">
                <UploadMemetropolisVideo />
                <TestMemetropolisPost />
                <TestRandomFactPost />
                <TestDailyGM />
              <TestTopActiveShoutout />
              <TestUserMentions />
              <TestBotslyMemePost />
              <TestConsolidateXPosts />
              <BulkUserImport />
                <BotConfig />
              </div>
            </TabsContent>

            <TabsContent value="admins">
              <AdminManagement />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>;
};
export default Index;