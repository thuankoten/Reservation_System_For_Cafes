import './ConfirmDialog.css'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <h4>{title}</h4>
        <p>{message}</p>

        <div className="confirmActions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
