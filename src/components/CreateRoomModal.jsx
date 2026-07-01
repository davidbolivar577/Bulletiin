import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function CreateRoomModal({ isOpen, onClose, user, setActiveRoom, chatRooms }) {
  const [newRoomName, setNewRoomName] = useState("");
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    setNewRoomName("");
    setIsPublicRoom(true);
    setErrorMsg("");
    onClose();
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault(); 
    const trimmedName = newRoomName.trim();
    
    if (!trimmedName) return;

    // Check if the name already exists in the user's visible rooms
    const nameExists = chatRooms.some(
      (room) => room.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameExists) {
      setErrorMsg("A room with this name already exists!");
      return; 
    }

    const userAlreadyCreatedRoom = chatRooms.some(
      (room) => room.creator === user.uid
    );

    if (userAlreadyCreatedRoom) {
      setErrorMsg("You can only create one room per account!");
      return;
    }

    setErrorMsg("");

    try {
      const channelsRef = collection(db, "channels");

      const safeName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const autoId = doc(channelsRef).id;
      const customDocId = `${safeName}-${autoId}`;

      // Create a reference to that specific custom ID
      const newRoomRef = doc(db, "channels", customDocId);

      await setDoc(newRoomRef, {
        allowedUsers: [user.uid],
        createdOn: serverTimestamp(),
        creator: user.uid,
        isPublic: true,
        last_message_at: serverTimestamp(),
        name: trimmedName,
        official: false,
        preview: "https://firebasestorage.googleapis.com/v0/b/bulletiin--with-tiims.appspot.com/o/default-room.png?alt=media" 
      });

      setActiveRoom(customDocId);

      handleClose();

    } catch (error) {
      console.error("Error creating room: ", error);
      setErrorMsg("Failed to create room.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create a New Room</h2>
        
        <form onSubmit={handleCreateRoom}>
          {errorMsg && <div style={{ color: '#ff6b6b', marginBottom: '15px', fontWeight: 'bold', textAlign: 'center' }}>{errorMsg}</div>}

          <div className="form-group">
            <label>Room Name:</label>
            <input 
              type="text" 
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(e.target.value);
                setErrorMsg(""); 
              }}
              placeholder="Room Name..."
              autoFocus
            />
          </div>

          <div className="form-group checkbox-group">
            <label style={{ opacity: 0.6, cursor: "not-allowed" }}>
              <input 
                type="checkbox" 
                checked={true}
                disabled
                onChange={(e) => setIsPublicRoom(e.target.checked)}
              />
              Public
            </label>
          </div>

          <input type="hidden" name="additionalUsers" value="" />

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={!newRoomName.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}