import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------
// AUTH VIEW 
// ---------------------------------------------------------
export function AuthView({ initialMode = 'login', onModeChange }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        setIsLogin(initialMode === 'login');
    }, [initialMode]);

    const toggleMode = () => {
        const newMode = !isLogin;
        setIsLogin(newMode);
        if (onModeChange) onModeChange(newMode ? 'login' : 'register');
        setMessage('');
        setConfirmPassword(''); 
        setPassword('');
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        
        if (isResetting) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/`, 
            });
            if (error) {
                setMessage(error.message);
            } else {
                setMessage('Check your email for the password reset link!');
                setIsResetting(false);
                setPassword('');
            }
        } else {
            let error;
            if (isLogin) {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                error = signInError;
            } else {
                if (password !== confirmPassword) {
                    setMessage("Passwords do not match. Please try again.");
                    setLoading(false);
                    return;
                }
                const { error: signUpError } = await supabase.auth.signUp({ email, password });
                error = signUpError;
                
                if (!error) {
                    setMessage('Success! Please check your email to verify your address and activate your free account.');
                    setPassword('');
                    setConfirmPassword('');
                }
            }

            if (error) {
                setMessage(error.message);
            }
        }
        setLoading(false);
    };

    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 mt-10">
            <h2 className="text-2xl font-bold text-center mb-6">
                {isResetting ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create an Account')}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>
                
                {!isResetting && (
                    <>
                        <div>
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                {isLogin && (
                                    <button type="button" onClick={() => { setIsResetting(true); setMessage(''); }} className="text-xs text-red-600 hover:text-red-800 font-medium">
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                        </div>

                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                            </div>
                        )}
                    </>
                )}
                
                <button type="submit" disabled={loading} className="w-full bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 transition">
                    {loading ? 'Processing...' : (isResetting ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Register'))}
                </button>
            </form>
            
            {message && <p className={`mt-4 text-center text-sm font-medium ${message.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
            
            <div className="mt-6 text-center border-t pt-4">
                {isResetting ? (
                    <button onClick={() => { setIsResetting(false); setMessage(''); }} className="text-sm text-gray-600 hover:text-red-600 font-medium">
                        Remembered your password? Sign in here.
                    </button>
                ) : (
                    <button onClick={toggleMode} className="text-sm text-gray-600 hover:text-red-600 font-medium">
                        {isLogin ? "Don't have an account? Register here." : "Already have an account? Sign in."}
                    </button>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// UPDATE PASSWORD VIEW
// ---------------------------------------------------------
export function UpdatePasswordView({ onSuccess }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpdate = async (e) => {
        e.preventDefault();
        setMessage('');

        if (newPassword !== confirmPassword) {
            setMessage('Error: Passwords do not match. Please try again.');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setMessage(error.message);
            setLoading(false);
        } else {
            setMessage('Password updated successfully! Taking you to your dashboard...');
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 mt-10">
            <h2 className="text-2xl font-bold text-center mb-6">Create New Password</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 transition">
                    {loading ? 'Saving...' : 'Update Password'}
                </button>
            </form>
            
            {message && (
                <p className={`mt-4 text-center text-sm font-medium ${message.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}