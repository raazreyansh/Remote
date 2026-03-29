import type { Server as HttpServer } from "node:http";

import type { Server as SocketIOServer } from "socket.io";
import { Server } from "socket.io";

import { config } from "../config";

let io: SocketIOServer | null = null;

export const restaurantRoom = (restaurantId: string) => `restaurant:${restaurantId}`;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    const restaurantId = socket.handshake.query.restaurantId;
    if (typeof restaurantId === "string" && restaurantId.length > 0) {
      socket.join(restaurantRoom(restaurantId));
    }

    socket.on("join-restaurant", (payload?: { restaurantId?: string }) => {
      if (payload?.restaurantId) {
        socket.join(restaurantRoom(payload.restaurantId));
      }
    });
  });

  return io;
};

export const emitRestaurantEvent = (restaurantId: string, event: string, payload: unknown) => {
  if (!io) {
    return;
  }

  io.to(restaurantRoom(restaurantId)).emit(event, payload);
};
