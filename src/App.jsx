//npm run build

import { useState, useEffect, useRef } from "react";

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'

import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp, query, orderBy, limitToLast, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import defaultPfp from './assets/default_pfp.jpg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  // Array to hold user messages
  const [messages, setMessages] = useState([]);
  // Current text input by the user:
  const [messageInput, setMessageInput] = useState("");

  // Channel state
  const [currentChannelId, setCurrentChannelId] = useState("official1");

  // Holds the ID of the clicked message
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  // Editing Messages states
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageInput, setEditMessageInput] = useState("");

  // Clear login info
  const [user, setUser] = useState(null)
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true)

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
    const messagesRef = collection(db, "channels", currentChannelId, "messages");

    // Message grabbing, and ordering logic
    const q = query(messagesRef, orderBy("timestamp", "asc"), limitToLast(50));

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
  }, [currentChannelId]);

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
      // Fixed: points to the specific channel rather than a root "messages" collection
      const messageRef = doc(db, "channels", currentChannelId, "messages", messageId);
      
      await updateDoc(messageRef, {
        message_content: "Deleted Message",
        pfp: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Icon-round-Question_mark.svg/3840px-Icon-round-Question_mark.svg.png",
        timestamp: serverTimestamp(),
        uid: null,
        username: "Deleted Message",
      });
    } catch (error) {
      console.error("Error deleting message: ", error);
    }
  };

  const updateMessage = async (messageId, newContent) => {
    try {
      // Fixed: points to the specific channel
      const messageRef = doc(db, "channels", currentChannelId, "messages", messageId);
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

  return (
    <>
      {/*This is start of the main chat room page.*/}
      <div className="app-container">
        <div className="sidebar">
          <h2>Chat Rooms</h2>
          <p>This is where the chat rooms and navigation will be displayed</p>
        </div>
        <div className="main-chat">
        
        {/*Chat Display Here: */}
        <div className="chat-messages">
          {messages.map((msg) => {
            // Check who message belongs to
            const isSelf = msg.uid === user.uid;
            
            // Check if message is selected
            const isSelected = selectedMessageId === msg.id;

            return (
              // apply proper class (sent or recieved)
              <div key={msg.id} className={`message-container ${isSelf ? "sent" : "received"} ${isSelected ? "selected-msg" : ""}`} onClick={() => setSelectedMessageId(isSelected ? null : msg.id)}>
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
                const messagesRef = collection(db, "channels", currentChannelId, "messages");

                await addDoc(messagesRef, {
                  message_content: messageInput,
                  timestamp: serverTimestamp(),
                  uid: user.uid, // Keep this as user.uid for security/tracking
  
                  username: dbUser?.displayName || "Unknown", 
                  pfp: dbUser?.avatarUrl || "" 
                });

                setMessageInput("");
              } catch (error) {
                alert("Error sending message to Firestore: " + error + " please take a screenshot of this and send it to the development team.");
              }
            }
          }}>
            <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Enter your message here..." />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
      {/*This is the end of the main chat room page.*/}
    </>
  )
}

export default App