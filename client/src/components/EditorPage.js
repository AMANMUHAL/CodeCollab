import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import { useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

function EditorPage() {
  const [clients, setClients] = useState([]);
  const codeRef = useRef(null);   // to avoid rendering of page on every code change

  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);

  const handleErrors = useCallback((err) => {
    console.log("Error", err);
    toast.error("Socket connection failed, Try again later");
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();    // used to connect to backend with those credentials
      socketRef.current.on("connect_error", handleErrors);
      socketRef.current.on("connect_failed", handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {    // send the room id to backend
        roomId,
        username: location.state?.username,
      });

      // Listen for new clients joining the chatroom
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {    // values from server side 
        // this ensures that the new user connected message does not display to that user itself
        if (username !== location.state?.username) {
          toast.success(`${username} joined the room.`);
        }
        setClients(clients);
        // also send the code to sync
        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          code: codeRef.current,
          socketId,
        });
      });

      // listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
    };
    init();

    // cleanup
    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    };
  }, [handleErrors, location.state, navigate, roomId]);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID is copied`);
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the Room ID");
    }
  };

  const leaveRoom = () => {
    navigate("/");
  };

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        {/* client panel */}
        <div
          className="col-md-2 bg-dark text-light d-flex flex-column h-100"
          style={{ boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.1)" }}
        >
          <img
            src="/images/logo.png"
            alt="Logo"
            className="img-fluid mx-auto"
            style={{ maxWidth: "250px", marginTop: "3px" }}
          />
          <hr style={{ marginTop: "-1rem" }} />

          {/* Client list container */}
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>

          <hr />
          {/* Buttons */}
          <div className="mt-auto ">
            <button className="btn btn-success" onClick={copyRoomId}>
              Copy Room ID
            </button>
            <button
              className="btn btn-danger mt-2 mb-2 px-3 btn-block"
              onClick={leaveRoom}
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="col-md-10 text-light d-flex flex-column h-100 ">
          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
