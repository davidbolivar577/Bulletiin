import { useState, useEffect, useRef } from "react";

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'
import CreateRoomModal from './components/CreateRoomModal.jsx'

import { db } from "./firebase.js";
import { collection, serverTimestamp, query, orderBy, limit, limitToLast, onSnapshot, doc, getDoc, getDocs, updateDoc, writeBatch, where, or, deleteDoc, setDoc } from "firebase/firestore";
import CryptoJS from "crypto-js"; 

import defaultPfp from './assets/default_pfp.jpg'
import newImg from './assets/new.png'
import editImg from './assets/edit.png'
import trashImg from './assets/trash.png'
import xImage from './assets/x.png'
import logoutImg from './assets/logout.png'
import './App.css'

function App() {
  // Mobile sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // SearchBar contents
  const [searchQuery, setSearchQuery] = useState("");

  // Array to hold user messages
  const [messages, setMessages] = useState([]);
  // Current text input by the user:
  const [messageInput, setMessageInput] = useState("");
  // User switching chatrooms
  const [activeRoom, setActiveRoom] = useState("official1");

  // const [currentOldestListMessage, setCurrentOldestListMessage] = useState(null);
  // const [lastOldestListMessage, setLastOldestListMessage] = useState(null);

  // WIP: this state will be changed based off scroll height (if the user is far enough from the bottom, they won't be scrolled down auatomatically when a message is sent)
  const [shouldIScroll, setShouldIScroll] = useState(true);

  // Holds the ID of the clicked message
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  // Editing Messages states
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageInput, setEditMessageInput] = useState("");

  // Clear login info
  const [user, setUser] = useState(null)
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true)

  const [chatRooms, setChatRooms] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Message limits (changes when a user scrolls to top)
  // const [messageLimit, setMessageLimit] = useState(11);

  // NEW
  // Replaces messageLimit. This acts as the "starting line" for our live listener.
  const [oldestTimestamp, setoldestTimestamp] = useState(null);
  
  // Tracks if a room has zero messages so the listener doesn't get stuck waiting for a floor
  const [isRoomEmpty, setIsRoomEmpty] = useState(false);

  // Holds the user's private keys { roomId: secretKey }
  const [keyring, setKeyring] = useState({});

  const [passwordPromptRoom, setPasswordPromptRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPassword, setShowJoinPassword] = useState(false);

  // Auth & Profile Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          // Save their custom database profile to state
          setDbUser(userDocSnap.data());
        } else {
          console.log("User document not found in database!");
        }
      } else {
        setUser(null);
        setDbUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Keyring Listener
  useEffect(() => {
    if (!user) return;
    const keysRef = collection(db, "users", user.uid, "keys");
    const unsubscribe = onSnapshot(keysRef, (snapshot) => {
      const keysObj = {};
      snapshot.forEach((doc) => {
        keysObj[doc.id] = doc.data().key;
      });
      setKeyring(keysObj);
    });
    return () => unsubscribe();
  }, [user]);

  // Grab messages, stick em in the list, and set up the initial message ceiling
  useEffect(() => {
    if (!user || !activeRoom) return;

    const messagesRef = collection(db, "channels", activeRoom, "messages");

    const assignInitialOldest = async() => {
      // Message grabbing, and ordering logic
      const q = query(messagesRef, orderBy("timestamp", "asc"), limitToLast(20));
  
      const snap = await getDocs(q);
      if (snap.empty) {
        setIsRoomEmpty(true);
        setoldestTimestamp(null);
      }
      else {
        setIsRoomEmpty(false);
        const oldestMessage = snap.docs[0]
        setoldestTimestamp(oldestMessage.data().timestamp);
      }
    };

      // Update and refresh messages
      setoldestTimestamp(null);
      setIsRoomEmpty(false);
      setMessages([]);

      assignInitialOldest();
    }, [activeRoom, user]);

  useEffect(() => {
    if (!user || !activeRoom || (!oldestTimestamp && !isRoomEmpty)) return;

    const messageRef = collection(db, "channels", activeRoom, "messages");
    let q;

    if(isRoomEmpty)
      q = query(messageRef, orderBy('timestamp', 'asc'));
    else
      q = query(messageRef, orderBy('timestamp', 'asc'), where("timestamp", ">=", oldestTimestamp));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];

      snapshot.forEach((doc) => {
        //  Grab data ALONG WITH DOCUMENT ID
        fetchedMessages.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [activeRoom, user, oldestTimestamp, isRoomEmpty]);

  useEffect(() => {
    if (!user) return;

    const channelsRef = collection(db, "channels");
    
    const channelsQuery = query(
      channelsRef, 
      orderBy("official", "desc"), 
      orderBy("last_message_at", "desc")
    );

    const unsubscribe = onSnapshot(channelsQuery, (snapshot) => {
      const fetchedChannels = [];
      snapshot.forEach((doc) => {
        fetchedChannels.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setChatRooms(fetchedChannels);
    });

    return () => unsubscribe();
  }, [user]);

  // target lock to null div (bottom of the messages)
  const messagesEndRef = useRef(null);

  // scroll down function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  // conditions (run it when "messages" changes)
  useEffect(() => {
    if (shouldIScroll) {
      scrollToBottom();
    }
    setShouldIScroll(true);
  }, [messages]);

  const formatTimeSince = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const date = timestamp.toDate();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User successfully logged out");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  //Loading screen
  if (loading) {
    return <div>Loading...</div>
  }

  //Login screen
  if (!user) {
    return <Login />
  }

  // Message Delete Function goes here
  const deleteMessage = async (messageId) => {
    try {
      const messageRef = doc(db, "channels", activeRoom, "messages", messageId);
      
      await updateDoc(messageRef, {
        message_content: "Deleted Message",
        pfp: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Icon-round-Question_mark.svg/3840px-Icon-round-Question_mark.svg.png",
        username: "Deleted Message",
        editedAt: serverTimestamp(),
        uid: null
      });
    } catch (error) {
      console.error("Error deleting message: ", error);
    }
  };

  const updateMessage = async (messageId, newContent) => {
    try {
      // Fixed: points to the specific channel
      const messageRef = doc(db, "channels", activeRoom, "messages", messageId);
      await updateDoc(messageRef, {
        message_content: newContent,
        // Updates the edited timestamp
        editedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating message: ", error);
    }
  };

  // Message clicked and then prompt for deletion
  const handleDeleteMessage = (messageId) => {
    if (window.confirm("Do you want to delete this message?")) {
      deleteMessage(messageId);
    }
  }

  const handleRoomClick = async (room) => {
    if (room.isPublic || keyring[room.id]) {
      setActiveRoom(room.id);
      setIsSidebarOpen(false);
    } else {
      setPasswordPromptRoom(room);
      setJoinPassword("");
      setShowJoinPassword(false);
    }
  };

  // Room deletion backend
  const handleDeleteRoom = async (roomId, roomCreatorId, e) => {
    if (e) e.stopPropagation(); 
    if (user.uid !== roomCreatorId) {
      alert("You only have permission to delete rooms you created.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this room? This cannot be undone.");
    if (!confirmDelete) return;

    try {
      const roomRef = doc(db, "channels", roomId);
      await deleteDoc(roomRef);
      if (activeRoom === roomId) setActiveRoom("official1"); 
    } catch (error) {
      console.error("Error deleting room:", error);
      alert("Failed to delete room. Check your console and database rules.");
    }
  };

  const getDecryptedPreview = (room) => {
    if (!room.last_message_preview) return null;
    if (room.isPublic) return room.last_message_preview;
    
    const secretKey = keyring[room.id];
    if (secretKey) {
      try {
        const bytes = CryptoJS.AES.decrypt(room.last_message_preview, secretKey);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        return decryptedText || "Encrypted text";
      } catch (e) { return "Encrypted text"; }
    }
    return "Private Room"; 
  };

  const messageLoad = async (e) => {
    if (e.target.scrollTop === 0 && oldestTimestamp) {
      setShouldIScroll(false); // Stop the auto-scroll down

      const messagesRef = collection(db, "channels", activeRoom, "messages");
      
      // Fetch 10 messages that are strictly OLDER than our current floor
      const q = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        where("timestamp", "<", oldestTimestamp),
        limit(10)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        // Find the new oldest message in this batch, and push the floor back!
        const newOldest = snap.docs[snap.docs.length - 1];
        setoldestTimestamp(newOldest.data().timestamp);
      } else {
        console.log("No more older messages to load.");
      }
    }
  };

  const filteredRooms = chatRooms.filter((room) =>
  room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="app-container">
        {/* dynamic sidebar class (open or close for mobile) */}
        <div className={`sidebar ${isSidebarOpen ? "mobile-open" : ""}`}>
          <div className="topBar">
            <h2 className="sidebar-title">Chat Rooms</h2>
            <div className="channelControls">
              <button
                className="create-room"
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setIsSidebarOpen(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="13" y1="7" x2="13" y2="21"></line>
                  <line x1="6" y1="14" x2="20" y2="14"></line>
                </svg>
              </button>
              <input 
                className="search-bar" 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="room-list">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                className={`room-card ${room.isPublic ? "public-room" : "private-room"} ${activeRoom === room.id ? "active" : ""} ${room.creator === user.uid ? "owned" : ""}`}
                onClick={() => handleRoomClick(room)}
              >
                <div className="room-header">
                  <h3 className="room-name">{room.name}</h3>

                  <span className="room-lock">
                    {room.isPublic ? "🌐" : "🔒"}
                  </span>
                </div>
                <div className="room-footer">
                  <div className="room-text">
                    <p className="room-last-message">
                      {room.last_message_preview ? (
                        <>
                          <span className="preview-text">{getDecryptedPreview(room)} </span>

                          {/* ONLY show the timestamp if the room is public or the user has the key */}
                          {(room.isPublic || keyring[room.id]) && (
                            <span className="preview-time"> • {formatTimeSince(room.last_message_at)}</span>
                          )}
                        </>
                      ) : (
                        <span className="preview-empty">No messages yet</span>
                      )}
                    </p>

                    <p className="room-created">
                      Created: {room.createdOn?.toDate().toLocaleDateString() || "Unknown"}
                    </p>

                    <p className="room-owner">
                      Owner: {room.owner || "Unknown"}
                    </p>
                  </div>
                  <button className="delete-room-btn" onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id, room.creator, e); }}>
                    <img src={xImage} alt="Delete" className="delete-room-img"/>
                  </button>
                </div>
              </button>
            ))}
          </div>
          <div className="user-info">
            <img src={dbUser?.avatarUrl || user.photoURL || defaultPfp} alt="profile" className="pfp" referrerPolicy="no-referrer" />
            <p className="user-name">{dbUser?.displayName || user.displayName || "Unknown"}</p>
            {/* <p className="user-email">{user.email}</p> */}
            <form className="logout-form" onSubmit={(e) => { e.preventDefault(); handleLogout(); }}>
              <button className="LogoutButton" onClick={handleLogout}><img src={logoutImg} alt="Logout" /></button>
            </form>
          </div>
        </div>

      {/* Main Chat Area */}
      <div className="main-chat">
        
        {/* Hamburger menu button for mobile */}
        <div className="mobile-header">
          <button 
            className="hamburger-btn" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            ☰ Channels
          </button>
        </div>


        {/*Chat Display Here: */}
        <div className="chat-messages" onScroll={messageLoad}>
          {messages.map((msg, index) => {
            // Check who message belongs to
            const isSelf = msg.uid === user.uid;
            
            // Check if message is selected
            const isSelected = selectedMessageId === msg.id;

            // Section to check for message strings sent by the same user
            // grab next item index
            const nextMessage = messages[index + 1];
            // check next message
            const isLastMessageInString = !nextMessage || nextMessage.uid !== msg.uid;

            return (
              // apply proper class (sent or recieved)
              <div key={msg.id} className={`message-container ${isSelf ? "sent" : "received"} ${isSelected ? "selected-msg" : ""} ${isLastMessageInString ? 'last-in-string' : ''}`} onClick={() => setSelectedMessageId(isSelected ? null : msg.id)}>
                <div className="bubbleAndActions">
                  <div className={`message-bubble`}>
                    <img src={msg.pfp || defaultPfp} alt="profile" className="pfp" referrerPolicy="no-referrer" />
                    <div className="message-bar"></div>
                        <span className="message-text">
                          {editingMessageId === msg.id ? (
                            <div className="edit-area">
                              <input value={editMessageInput} onChange={(e) => setEditMessageInput(e.target.value)} />
                              <button onClick={(e) => { e.stopPropagation(); updateMessage(msg.id, editMessageInput); setEditingMessageId(null); setEditMessageInput(""); }}>Save</button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingMessageId(null); setEditMessageInput(""); }}>Cancel</button>
                            </div>
                          ) : (
                            msg.message_content
                          )}
                        </span>
                  </div>
                  { isSelf && isSelected && (
                      <div className="message-actions">
                        {editingMessageId !== msg.id ? (
                          <>
                            <button className="editMessage" onClick={(e) => { e.stopPropagation(); setEditingMessageId(msg.id); setEditMessageInput(msg.message_content); }}><img src={editImg} alt="Edit"/></button>
                            <button className="deleteMessage" onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}><img src={trashImg} alt="Delete"/></button>
                          </>
                        ) : null}
                      </div>
                    )}
                </div>
                
                <div className="sent-by">
                    <i>{msg.username}</i>
                </div>
                     
              </div>
            );
          })}
          
          {/* Here's the null target div */}
          <div ref={messagesEndRef} />
        </div>
          
        {/* User Input Here: */}
        <p className="input-prompt">Type your message below:</p>
        <form className="message-input" onSubmit={async (e) => {
          e.preventDefault();

          if (messageInput.trim()) {
            try {
              const batch = writeBatch(db);

              const messagesRef = collection(db, "channels", activeRoom, "messages");
              const newMessageRef = doc(messagesRef);

              batch.set(newMessageRef, {
                message_content: messageInput,
                timestamp: serverTimestamp(),
                uid: user.uid,
                username: dbUser?.displayName || user.displayName || "Unknown",
                pfp: dbUser?.avatarUrl || user.photoURL || ""
              });

              let previewText = messageInput;
              const currentRoom = chatRooms.find(r => r.id === activeRoom);
              if (currentRoom && !currentRoom.isPublic) {
                const secretKey = keyring[activeRoom];
                if (secretKey) {
                  previewText = CryptoJS.AES.encrypt(messageInput, secretKey).toString();
                }
              }

              // parent channel
              const channelRef = doc(db, "channels", activeRoom);

              batch.update(channelRef, {
                last_message_at: serverTimestamp(),
                last_message_preview: previewText
              });

              await batch.commit();

              setMessageInput("");
            } catch (error) {
              alert("Error sending message: " + error);
            }
          }
        }}>
          <div className="inputAndButton">
            <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Enter your message here..." />
            <button type="submit">send</button>
          </div>
        </form>
      </div>
    </div>
    {/*This is the end of the main chat room page.*/}
    {passwordPromptRoom && (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Join Private Room</h2>
          <p style={{ marginBottom: '15px' }}>The room <strong>"{passwordPromptRoom.name}"</strong> is private. Enter password:</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const hash1 = CryptoJS.SHA256(joinPassword).toString();
            const hash2 = CryptoJS.SHA256(hash1).toString();

            if (hash2 === passwordPromptRoom.passwordHash) {
              try {
                const keyRef = doc(db, "users", user.uid, "keys", passwordPromptRoom.id);
                await setDoc(keyRef, { key: hash1, addedAt: serverTimestamp() });
                setActiveRoom(passwordPromptRoom.id);
                setIsSidebarOpen(false);
                setPasswordPromptRoom(null);
              } catch (error) {
                console.error(error);
                alert("Failed to join room. Check database rules.");
              }
            } else {
              alert("Incorrect password!");
            }
          }}>
            <div className="form-group">
              <div className="password-input-wrapper">
                <input 
                  type={showJoinPassword ? "text" : "password"} 
                  value={joinPassword} 
                  onChange={(e) => setJoinPassword(e.target.value)} 
                  placeholder="Password..."
                  autoFocus 
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={() => setShowJoinPassword(!showJoinPassword)}
                >
                  {showJoinPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="cancel-btn" onClick={() => setPasswordPromptRoom(null)}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={!joinPassword.trim()}>
                Join
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    <CreateRoomModal 
      isOpen={isCreateModalOpen} 
      onClose={() => setIsCreateModalOpen(false)} 
      user={user} 
      setActiveRoom={setActiveRoom} 
      chatRooms={chatRooms}
    />
    </>
  )
}


//force rebuild
export default App