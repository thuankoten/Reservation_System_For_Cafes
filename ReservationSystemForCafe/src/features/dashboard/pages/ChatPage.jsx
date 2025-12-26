export default function ChatPage() {
  return (
    <div className="card">
      <h2 className="pageTitle">Chat</h2>
      <div className="muted">(Placeholder) You can implement realtime chat with Firestore later.</div>

      <div style={{ marginTop: 12 }} className="muted">
        Suggestion:
        <div>Collection: chats/{'{roomId}'}/messages</div>
      </div>
    </div>
  )
}
