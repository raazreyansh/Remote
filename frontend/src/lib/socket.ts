import { io } from "socket.io-client";

import { API_BASE_URL } from "./config";

export const connectRestaurantSocket = (restaurantId: string) =>
  io(API_BASE_URL, {
    transports: ["websocket"],
    query: { restaurantId },
  });
