import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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

    setErrorMsg("");

    try {
      const channelsRef = collection(db, "channels");

      const docRef = await addDoc(channelsRef, {
        allowedUsers: [user.uid],
        createdOn: serverTimestamp(),
        creator: user.uid,
        isPublic: isPublicRoom,
        last_message_at: serverTimestamp(),
        name: trimmedName,
        official: false
    });

      setActiveRoom(docRef.id); // Switch to the new room

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
            <label>
              <input 
                type="checkbox" 
                checked={isPublicRoom}
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