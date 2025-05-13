package com.example.webrtc;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import java.util.*;

@Controller
public class MainController {

    // Map of roomId to set of userIds
    private final Map<String, Set<String>> rooms = new HashMap<>();

    @Autowired
    SimpMessagingTemplate simpMessagingTemplate;

    @RequestMapping(value = "/", method = RequestMethod.GET)
    public String Index() {
        return "index";
    }

    @MessageMapping("/testServer")
    public void testServer(String test) {
        System.out.println("Testing Server: " + test);
        simpMessagingTemplate.convertAndSend("/topic/testServer", test);
    }

    @MessageMapping("/joinRoom")
    public void joinRoom(String joinData) {
        JSONObject jsonObject = new JSONObject(joinData);
        String userId = jsonObject.getString("userId");
        String roomId = jsonObject.getString("roomId");

        // Add user to room
        rooms.computeIfAbsent(roomId, k -> new HashSet<>()).add(userId);
        System.out.println("User " + userId + " joined room " + roomId);

        // Notify all room members (except the joining user) of the new user
        for (String member : rooms.get(roomId)) {
            if (!member.equals(userId)) {
                simpMessagingTemplate.convertAndSendToUser(
                        member,
                        "/topic/room/" + roomId + "/join",
                        userId
                );
            }
        }

        // Send current room members to the joining user
        simpMessagingTemplate.convertAndSendToUser(
                userId,
                "/topic/room/" + roomId + "/members",
                rooms.get(roomId).toArray()
        );
    }

    @MessageMapping("/offer")
    public void offer(String offer) {
        JSONObject jsonObject = new JSONObject(offer);
        String roomId = jsonObject.getString("roomId");
        String toUser = jsonObject.getString("toUser");
        String fromUser = jsonObject.getString("fromUser");

        System.out.println("Offer from " + fromUser + " to " + toUser + " in room " + roomId);
        simpMessagingTemplate.convertAndSendToUser(
                toUser,
                "/topic/room/" + roomId + "/offer",
                offer
        );
    }

    @MessageMapping("/answer")
    public void answer(String answer) {
        JSONObject jsonObject = new JSONObject(answer);
        String roomId = jsonObject.getString("roomId");
        String toUser = jsonObject.getString("toUser");
        String fromUser = jsonObject.getString("fromUser");

        System.out.println("Answer from " + fromUser + " to " + toUser + " in room " + roomId);
        simpMessagingTemplate.convertAndSendToUser(
                toUser,
                "/topic/room/" + roomId + "/answer",
                answer
        );
    }

    @MessageMapping("/candidate")
    public void candidate(String candidate) {
        JSONObject jsonObject = new JSONObject(candidate);
        String roomId = jsonObject.getString("roomId");
        String toUser = jsonObject.getString("toUser");
        String fromUser = jsonObject.getString("fromUser");

        System.out.println("Candidate from " + fromUser + " to " + toUser + " in room " + roomId);
        simpMessagingTemplate.convertAndSendToUser(
                toUser,
                "/topic/room/" + roomId + "/candidate",
                candidate
        );
    }
}
