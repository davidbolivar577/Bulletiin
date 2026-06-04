//npm run build

import { useState, useEffect } from 'react'

import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'

import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  // Array to hold user messages (This might be changed to database calls later on):
  const [messages, setMessages] = useState([]);
  // Current text input by the user:
  const [messageInput, setMessageInput] = useState("");

  //Clear login info
  const [user, setUser] = useState(null) //possibly pull from cookies
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])

  //Loading screen
  if (loading) {
    return <div>Loading...</div>
  }

  //Login screen
  if (!user) {
    return <Login />
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
            {messages.map((msg, index) => (
              <div key = {index} className= "message-bubble">{msg}</div>
            ))}
          </div>
          
          {/*User Input Here: */}
          <p className = "input-prompt">Type your message below:</p>
          <form className = "message-input" onSubmit = {(e) => {
            e.preventDefault();
            if (messageInput.trim()) {
              setMessages([...messages, messageInput]); // Adding new message state.
              setMessageInput(""); // Clears message input after sending.
            }
          }}>
            <input value = {messageInput} onChange = {(e) => setMessageInput(e.target.value)}
            placeholder = "Enter your message here..."/>
            <button type = "submit">Send</button>
          </form>
        </div>
      </div>
      {/*This is the end of the main chat room page.*/}
    </>
  )
}

export default App
