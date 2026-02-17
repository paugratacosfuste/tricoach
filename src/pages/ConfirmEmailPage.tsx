import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Mail, ArrowRight } from 'lucide-react';

export default function ConfirmEmailPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
            <div className="w-full max-w-md space-y-8">
                {/* Logo */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
                        <Activity className="w-7 h-7 text-white" />
                    </div>
                </div>

                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Check your email</h2>
                    </CardHeader>
                    <CardContent className="text-center space-y-3 pb-6">
                        <p className="text-slate-400">
                            We've sent you a confirmation link. Click the link in your email to activate your account and start training.
                        </p>
                        <p className="text-sm text-slate-500">
                            Don't see it? Check your spam folder or try signing up again.
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Link to="/login" className="w-full">
                            <Button
                                variant="default"
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium"
                            >
                                Go to Sign In
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link to="/signup" className="w-full">
                            <Button
                                variant="ghost"
                                className="w-full text-slate-400 hover:text-white"
                            >
                                Try again with a different email
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
