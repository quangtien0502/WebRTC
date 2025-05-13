const localVideo = document.getElementById("localVideo");
const userIdInp = document.getElementById("userId");
const roomIdInp = document.getElementById("roomId");
const joinBtn = document.getElementById("joinBtn");
const testConnection = document.getElementById("testConnection");
const videosDiv = document.getElementById("videos");
let localStream;
let stompClient;
let userId;
let roomId;
let device;
let sendTransport;
let recvTransport;
const consumers = new Map();

// Connect to mediasoup server
const socket = io('https://192.168.1.6:3000'); // Update for production
// ICE Servers
const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
        // Add TURN server for production
    ]
};

// Initialize local media stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
    })
    .catch(error => {
        console.error("Error accessing media devices:", error);
    });

joinBtn.onclick = () => {
    userId = userIdInp.value;
    roomId = roomIdInp.value;
    if (!userId || !roomId) {
        alert("Please enter User ID and Room ID");
        return;
    }

    // Connect to Spring Boot signaling server
    const stompSocket = new SockJS('/websocket', {debug: false}); // Update for production
    stompClient = Stomp.over(stompSocket);
    stompClient.connect({}, () => {
        // Join mediasoup room
        socket.emit('joinRoom', { roomId, userId }, async ({ rtpCapabilities }) => {
            device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: rtpCapabilities });

            // Create send transport
            socket.emit('createTransport', { isProducer: true }, async ({ id, iceParameters, iceCandidates, dtlsParameters }) => {
                sendTransport = device.createSendTransport({
                    id,
                    iceParameters,
                    iceCandidates,
                    dtlsParameters,
                    iceServers
                });

                sendTransport.on('connect', ({ dtlsParameters }, callback) => {
                    socket.emit('connectTransport', { transportId: id, dtlsParameters }, callback);
                });

                sendTransport.on('produce', async ({ kind, rtpParameters }, callback) => {
                    socket.emit('produce', { transportId: id, kind, rtpParameters }, ({ id }) => {
                        callback({ id });
                    });
                });

                // Produce audio and video
                localStream.getTracks().forEach(async track => {
                    await sendTransport.produce({ track });
                });
            });

            // Create receive transport
            socket.emit('createTransport', { isProducer: false }, async ({ id, iceParameters, iceCandidates, dtlsParameters }) => {
                recvTransport = device.createRecvTransport({
                    id,
                    iceParameters,
                    iceCandidates,
                    dtlsParameters,
                    iceServers
                });

                recvTransport.on('connect', ({ dtlsParameters }, callback) => {
                    socket.emit('connectTransport', { transportId: id, dtlsParameters }, callback);
                });
            });
        });

        // Handle new producer (new stream available)
        socket.on('newProducer', ({ producerId, userId: remoteUserId, kind }) => {
            if (remoteUserId !== userId) {
                socket.emit('consume', {
                    transportId: recvTransport.id,
                    producerId,
                    rtpCapabilities: device.rtpCapabilities
                }, ({ id, producerId, kind, rtpParameters }) => {
                    recvTransport.consume({
                        id,
                        producerId,
                        kind,
                        rtpParameters
                    }).then(consumer => {
                        consumers.set(consumer.id, consumer);
                        let video = document.getElementById(`video-${remoteUserId}`);
                        if (!video) {
                            video = document.createElement("video");
                            video.id = `video-${remoteUserId}`;
                            video.autoplay = true;
                            videosDiv.appendChild(video);
                        }
                        video.srcObject = new MediaStream([consumer.track]);
                        consumer.resume();
                    });
                });
            }
        });

        // Subscribe to room join notifications
        stompClient.subscribe(`/user/${userId}/topic/room/${roomId}/join`, (message) => {
            console.log(`New user joined: ${message.body}`);
            // No offer/answer needed with SFU
        });

        // Subscribe to room members list
        stompClient.subscribe(`/user/${userId}/topic/room/${roomId}/members`, (message) => {
            const members = JSON.parse(message.body);
            console.log(`Room members: ${members}`);
            // No action needed; mediasoup handles connections
        });

        // Join the room via signaling server
        stompClient.send("/app/joinRoom", {}, JSON.stringify({
            userId: userId,
            roomId: roomId
        }));

        console.log("My console log: Click joined Room")
    });
};

testConnection.onclick = () => {
    if (stompClient) {
        stompClient.send("/app/testServer", {}, "Test Server");
    }
};