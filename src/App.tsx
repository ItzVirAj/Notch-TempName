import Notch from "./island/Notch";

// Set to false to hide the native window debug outline during dev
const SHOW_DEBUG_OUTLINE = true;

export default function App() {
  const showOutline = import.meta.env.DEV && SHOW_DEBUG_OUTLINE;

  return (
    <div className="w-[640px] h-[240px] relative box-border bg-transparent select-none">
      <Notch showDebugOutline={showOutline} />
    </div>
  );
}
