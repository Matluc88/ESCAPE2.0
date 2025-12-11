import React from 'react'
import './NotificationToast.css'

function NotificationToast({ notifications }) {
  if (!notifications || notifications.length === 0) {
    return null
  }

  return (
    <div className="toast-container">
      {notifications.map((notification) => (
        <div key={notification.id} className="toast">
          <div className="toast-message">{notification.message}</div>
          <div className="toast-timestamp">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  )
}

export default NotificationToast
