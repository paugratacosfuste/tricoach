import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signUp: (email: string, password: string, firstName?: string) => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (email: string, password: string, firstName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                },
            },
        });

        if (!error && firstName) {
            // The profile is auto-created by the DB trigger, but we update the first_name
            // We need to wait a moment for the trigger to fire
            setTimeout(async () => {
                const { data: { user: newUser } } = await supabase.auth.getUser();
                if (newUser) {
                    await supabase
                        .from('profiles')
                        .update({ first_name: firstName })
                        .eq('id', newUser.id);
                }
            }, 1000);
        }

        return { error: error ? new Error(error.message) : null };
    };

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error: error ? new Error(error.message) : null };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        // Clear any localStorage data on sign out
        localStorage.removeItem('onboarding_data');
        localStorage.removeItem('onboarding_complete');
        localStorage.removeItem('onboarding_started');
        localStorage.removeItem('tricoach_plan');
        localStorage.removeItem('tricoach_user_data');
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        return { error: error ? new Error(error.message) : null };
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                isLoading,
                signUp,
                signIn,
                signOut,
                resetPassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
