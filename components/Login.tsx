import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { APP_NAME, COMPANY_NAME } from '../constants';
import { LogIn, Loader2, Mail } from 'lucide-react';

import { useToast } from '../components/Toast';

export const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);

            // 動態取得當前網域 (例如 http://localhost:3000 或 http://192.168.x.x:3000)
            // 這樣在不同環境下或是正式網域上線時，都不需要手動修改程式碼
            // 注意：您需要在 Supabase Dashboard 的 Authentication > Redirect URLs 中
            // 加入對應的網址（例如您的 IP 網址），否則 Supabase 會自動跳回預設的 Site URL (localhost)
            const redirectUrl = window.location.origin;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                }
            });
            if (error) throw error;
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error('登入失敗: ' + (error.message || '未知錯誤'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f7ff] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-blue-100/50 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-blue-50/50 rounded-full blur-3xl"></div>
            </div>

            <div className="z-10 w-full max-w-md animate-fadeIn">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 mb-6 group transition-transform hover:scale-105 duration-300">
                        <div className="grid grid-cols-2 gap-1.5 p-4">
                            <div className="w-3.5 h-3.5 bg-white/40 rounded-sm"></div>
                            <div className="w-3.5 h-3.5 bg-white rounded-sm"></div>
                            <div className="w-3.5 h-3.5 bg-white rounded-sm"></div>
                            <div className="w-3.5 h-3.5 bg-white/40 rounded-sm"></div>
                        </div>
                    </div>
                    <div className="bg-gray-200 px-3 py-1 inline-block rounded-sm mb-3 border border-gray-300 font-bold text-[10px] tracking-widest text-blue-700">
                        {COMPANY_NAME}
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                        {APP_NAME}
                    </h1>
                    <p className="text-gray-500 font-medium">提升團隊效率，掌握每週關鍵目標</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100/50 p-8 border border-white">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">歡迎回來</h2>
                        <p className="text-gray-400 text-sm text-center font-medium">請使用公司 Google 帳號登入系統</p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full relative flex items-center justify-center gap-3 bg-white border border-gray-200 py-4 px-6 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 hover:border-blue-400 transition-all active:scale-[0.98] shadow-sm disabled:opacity-70 group"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            ) : (
                                <>
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>使用 Google 帳號登入</span>
                                </>
                            )}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-3 text-gray-300 font-bold">OR</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-xs text-gray-400 font-medium leading-relaxed px-4">
                                注意：初次登入可能需要管理員授權權限。<br />
                                如有疑問請洽公司系統管理員。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-12 text-center">
                    <div className="flex items-center justify-center gap-6 text-gray-400 text-sm font-semibold">
                        <span className="cursor-help hover:text-blue-500 transition-colors">使用條款</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="cursor-help hover:text-blue-500 transition-colors">隱私權政策</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="cursor-help hover:text-blue-500 transition-colors">版本 v1.0.0</span>
                    </div>
                    <p className="mt-4 text-[10px] text-gray-300 uppercase tracking-widest font-black italic">
                        Powered by Antigravity Technology
                    </p>
                </div>
            </div>
        </div>
    );
};
