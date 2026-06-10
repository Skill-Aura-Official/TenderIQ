import { SignUp, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50 relative overflow-hidden px-4">
      {/* Background radial glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[130px] -z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      
      {/* Clerk loading state spinner fallback */}
      <ClerkLoading>
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Securing gateway connection...</p>
        </div>
      </ClerkLoading>

      {/* Clerk loaded component */}
      <ClerkLoaded>
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#6366f1", // Indigo 500
              colorBackground: "#0b0f19", // Very dark custom slate
              colorInputBackground: "#1e293b", // Slate 800
              colorInputText: "#f8fafc", // Slate 50
              colorText: "#f8fafc",
              colorTextSecondary: "#94a3b8", // Slate 400
              colorDanger: "#ef4444",
              fontFamily: "var(--font-inter), sans-serif",
            },
            elements: {
              card: "border border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl rounded-2xl p-6",
              headerTitle: "text-slate-50 font-bold",
              headerSubtitle: "text-slate-400 text-sm",
              socialButtonsBlockButton: "bg-slate-800 hover:bg-slate-700/80 border border-white/10 text-slate-100 hover:text-white transition-colors",
              socialButtonsBlockButtonText: "text-slate-200 hover:text-white font-medium",
              formButtonPrimary: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20 active:bg-indigo-600 transition-all font-semibold",
              formFieldLabel: "text-slate-300 font-medium text-xs",
              formFieldInput: "bg-slate-800/80 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg transition-all",
              footerActionText: "text-slate-400 text-xs",
              footerActionLink: "text-indigo-400 hover:text-indigo-300 transition-colors font-medium",
              dividerLine: "bg-white/5",
              dividerText: "text-slate-500 font-mono text-[10px]",
              identityPreviewText: "text-slate-300",
              identityPreviewEditButtonIcon: "text-indigo-400 hover:text-indigo-300",
              userButtonPopoverActionButtonText: "text-slate-200",
              formResendCodeLink: "text-indigo-400 hover:text-indigo-300",
            }
          }}
        />
      </ClerkLoaded>
    </div>
  );
}
