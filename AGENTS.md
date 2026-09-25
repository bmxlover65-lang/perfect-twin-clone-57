<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Sports odds freshness is measured from the exchange frame's `updatedAt`, never the hot-cache refresh time; a cached fallback must remain marked stale because replaying it is not a new market tick.
Exchange long-poll sessions must reconnect and re-subscribe watched sports events when polls fail or an event goes silent; edge instances can lose subscriptions independently.
Sports exchange subscriptions require match metadata (event type, competition ID, sport, and in-play state); read the exchange's `updatedAt` as the frame timestamp so replayed packets never appear fresh.
