import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import CryptoJS from "crypto-js";

export default function CreateRoomModal({ isOpen, onClose, user, setActiveRoom, chatRooms }) {
  const [newRoomName, setNewRoomName] = useState("");
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [roomPassword, setRoomPassword] = useState(""); 
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setNewRoomName("");
    setIsPublicRoom(true);
    setRoomPassword("");
    setErrorMsg("");
    onClose();
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault(); 
    const trimmedName = newRoomName.trim();
    
    if (!trimmedName) return;

    if (!isPublicRoom && roomPassword.trim().length < 4) {
      setErrorMsg("Private rooms need a password (min 4 characters).");
      return;
    }

    const nameExists = chatRooms.some(
      (room) => room.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameExists) {
      setErrorMsg("A room with this name already exists!");
      return; 
    }

    if (!isPublicRoom) {
      const userAlreadyCreatedPrivateRoom = chatRooms.some(
        (room) => room.creator === user.uid && room.isPublic === false
      );

      if (userAlreadyCreatedPrivateRoom) {
        setErrorMsg("You can only create one private room per account!");
        return;
      }
    }

    setErrorMsg("");

    try {
      const channelsRef = collection(db, "channels");

      const safeName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const autoId = doc(channelsRef).id;
      const customDocId = `${safeName}-${autoId}`;

      const newRoomRef = doc(db, "channels", customDocId);

      let hash1 = null;
      let hash2 = null;

      if (!isPublicRoom) {
        hash1 = CryptoJS.SHA256(roomPassword).toString();
        hash2 = CryptoJS.SHA256(hash1).toString();
      }

      await setDoc(newRoomRef, {
        name: trimmedName,
        creator: user.uid,          
        owner: user.displayName,    
        createdOn: serverTimestamp(), 
        isPublic: isPublicRoom, 
        last_message_at: serverTimestamp(),
        last_message_preview: isPublicRoom ? "New Room" : "", 
        official: false,
        preview: "https://firebasestorage.googleapis.com/v0/b/bulletiin--with-tiims.appspot.com/o/default-room.png?alt=media",
        ...( !isPublicRoom && { passwordHash: hash2 } ) 
      });

      if (!isPublicRoom && hash1) {
        const keyringRef = doc(db, "users", user.uid, "keys", customDocId);
        await setDoc(keyringRef, {
          key: hash1,
          addedAt: serverTimestamp()
        });
      }

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
            <label>
              <input 
                type="checkbox" 
                checked={isPublicRoom}
                onChange={(e) => setIsPublicRoom(e.target.checked)}
              />
              Public
            </label>
          </div>

          {!isPublicRoom && (
            <div className="form-group">
              <label>Room Password:</label>
              
              <div className="password-input-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={roomPassword}
                  onChange={(e) => {
                    setRoomPassword(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="Make it memorable..."
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              
              <small style={{display: 'block', marginTop: '4px', opacity: 0.7}}>
                Passwords cannot be changed later.
              </small>
            </div>
          )}

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