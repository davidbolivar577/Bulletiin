import { useState, useEffect, useRef } from "react";

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'
import CreateRoomModal from './components/CreateRoomModal.jsx'

import { db } from "./firebase.js";
import { collection, serverTimestamp, query, orderBy, limitToLast, onSnapshot, doc, getDoc, updateDoc, writeBatch, where, or } from "firebase/firestore";

import defaultPfp from './assets/default_pfp.jpg'
import newImg from './assets/new.png'
import './App.css'

function App() {
  // Mobile sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Array to hold user messages
  const [messages, setMessages] = useState([]);
  // Current text input by the user:
  const [messageInput, setMessageInput] = useState("");
  // User switching chatrooms
  const [activeRoom, setActiveRoom] = useState("official1");

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
  const [messageLimit, setMessageLimit] = useState(10);

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

  // Firestore messages listener
  useEffect(() => {
    if (!user) return;
    const messagesRef = collection(db, "channels", activeRoom, "messages");

    // Message grabbing, and ordering logic
    const q = query(messagesRef, orderBy("timestamp", "asc"), limitToLast(messageLimit));

    // actual listener/refresh function
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];

      snapshot.forEach((doc) => {
        // Grab data ALONG WITH DOCUMENT ID
        fetchedMessages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Update and refresh messages
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [activeRoom, messageLimit, user]);

  useEffect(() => {
    if (!user) return;

    const channelsRef = collection(db, "channels");
    
    const channelsQuery = query(
      channelsRef, 
      or(
        where("isPublic", "==", true),
        where("allowedUsers", "array-contains", user.uid)
      ),
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
    scrollToBottom();
  }, [messages]);

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

  const messageLoad = (e) => {
    if (e.target.scrollTop === 0) {
      setMessageLimit((prev) => prev + 10);
    }
  };

  return (
    <>
      <div className="app-container">
        {/* dynamic sidebar class (open or close for mobile) */}
        <div className={`sidebar ${isSidebarOpen ? "mobile-open" : ""}`}>
          <h2 className="sidebar-title">Chat Rooms</h2>

          <div className="room-list">
            {chatRooms.map((room) => (
              <button
                key={room.id}
                className={`room-card ${room.isPublic ? "public-room" : "private-room"} ${activeRoom === room.id ? "active" : ""}`}
                onClick={() => {
                  setActiveRoom(room.id);
                  setIsSidebarOpen(false); // Closes menu automatically when a room is clicked
                }}
              >
                <div className="room-preview">
                  <img src={room.preview} alt={room.name} />
                </div>
                <p className="room-name">{room.name}</p>
              </button>
            ))}
            <button
                className={`room-card`}
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setIsSidebarOpen(false); // Closes menu automatically when a room is clicked
                }}
              >
                <div className="room-preview">
                  <img src={newImg} alt="new room" />
                </div>
                <p className="room-name">Create new room</p>
              </button>
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
                            <button onClick={(e) => { e.stopPropagation(); setEditingMessageId(msg.id); setEditMessageInput(msg.message_content); }}>Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}>Delete</button>
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

              // parent channel
              const channelRef = doc(db, "channels", activeRoom);

              batch.update(channelRef, {
                last_message_at: serverTimestamp()
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
          <form className="logout-form" onSubmit={(e) => { e.preventDefault(); handleLogout(); }}>
            <button className="LogoutButton" onClick={handleLogout}>Logout</button>
          </form>
        </form>
      </div>
    </div>
    {/*This is the end of the main chat room page.*/}
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