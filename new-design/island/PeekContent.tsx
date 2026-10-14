import { useMediaStore } from "../store/mediaStore";
import { NoteIcon } from "./icons";

/**
 * Hover preview inside the small peek shape.
 * Playing: art, title, artist. Otherwise: the time and date, so the peek is
 * always worth the hover. The time is read when the peek renders, so there is
 * no timer running anywhere.
 */
export function PeekContent() {
  const snapshot = useMediaStore((s) => s.snapshot);
  const thumbnailUrl = useMediaStore((s) => s.thumbnailUrl);

  if (snapshot.hasSession && snapshot.title) {
    return (
      <div className="nt-peek">
        <span className="nt-peek-art">
          {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : <NoteIcon size={13} />}
        </span>
        <span className="nt-peek-title">{snapshot.title}</span>
        {snapshot.artist && <span className="nt-peek-sub">{snapshot.artist}</span>}
      </div>
    );
  }

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="nt-peek">
      <span className="nt-peek-title">{time}</span>
      <span className="nt-peek-sub">{date}</span>
    </div>
  );
}
