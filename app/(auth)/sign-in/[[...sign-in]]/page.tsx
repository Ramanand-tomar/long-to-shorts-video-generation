import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4 relative overflow-hidden">
      {/* Decorative gradient glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      
      <SignIn 
        appearance={{
          variables: {
            colorPrimary: "#7c3aed",
            colorBackground: "#12121a",
            colorForeground: "#ffffff",
            colorMutedForeground: "#9ca3af",
            colorInput: "#1f1f2e",
            colorInputForeground: "#ffffff",
            colorBorder: "#2d2d3f",
          },
          elements: {
            card: "border border-zinc-800 shadow-2xl rounded-2xl",
            headerTitle: "text-2xl font-extrabold text-white tracking-tight",
            headerSubtitle: "text-zinc-400 text-sm",
            socialButtonsBlockButton: "bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 transition-all",
            socialButtonsBlockButtonText: "text-zinc-300 font-medium",
            formButtonPrimary: "bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-all",
            footerActionText: "text-zinc-400",
            footerActionLink: "text-violet-400 hover:text-violet-300 transition-all font-medium",
          }
        }} 
      />
    </div>
  );
}
