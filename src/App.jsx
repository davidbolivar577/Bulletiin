import { useState, useEffect, useRef } from "react";

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'
import CreateRoomModal from './components/CreateRoomModal.jsx'

import { db } from "./firebase.js";
import { collection, serverTimestamp, query, orderBy, limitToLast, onSnapshot, doc, getDoc, updateDoc, writeBatch, where, or } from "firebase/firestore";

import defaultPfp from './assets/default_pfp.jpg'
import newImg from './assets/new.png'
import editImg from './assets/edit.png'
import trashImg from './assets/trash.png'
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

  const [currentOldestListMessage, setCurrentOldestListMessage] = useState(null);
  const [lastOldestListMessage, setLastOldestListMessage] = useState(null);

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
      setLastOldestListMessage(currentOldestListMessage);
      setCurrentOldestListMessage(fetchedMessages[0]?.id || null);
      console.log(currentOldestListMessage, lastOldestListMessage);
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
    if (shouldIScroll) {
      scrollToBottom();
    }
    setShouldIScroll(true);
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
      if (currentOldestListMessage === lastOldestListMessage && currentOldestListMessage !== null) {
        console.log("No more messages to load.");
        return;
      }
      setShouldIScroll(false);
      setMessageLimit((prev) => prev + 10);
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
                className={`room-card ${room.isPublic ? "public-room" : "private-room"} ${activeRoom === room.id ? "active" : ""}`}
                onClick={() => {
                  setActiveRoom(room.id);
                  setIsSidebarOpen(false);
                }}
              >
                <div className="room-header">
                  <h3 className="room-name">{room.name}</h3>

                  <span className="room-lock">
                    {room.isPublic ? "🌐" : "🔒"}
                  </span>
                </div>

                <p className="room-created">
                  Created: {room.createdOn?.toDate().toLocaleDateString() || "Unknown"}
                </p>

                <p className="room-owner">
                  Owner: {room.owner || "Unknown"}
                </p>
              </button>
            ))}
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
