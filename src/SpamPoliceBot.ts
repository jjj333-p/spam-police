// Copyright 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: Apache-2.0

import {
  ProtectedRoomsSet,
  ClientPlatform,
  RoomStateManager,
  PolicyRoomManager,
  RoomMembershipManager,
  StringUserID,
  StringRoomID,
  RoomEvent,
  ClientRooms,
} from "matrix-protection-suite";
import { MatrixSendClient } from "matrix-protection-suite-for-matrix-bot-sdk";

export class SpamPoliceBot {
  private handleTimelineEventListener = this.handleTimelineEvent.bind(this);
  public constructor(
    /** The userID for the main bot user. */
    public readonly clientUserID: StringUserID,
    public readonly managementRoomID: StringRoomID,
    public readonly protectedRoomsSet: ProtectedRoomsSet,
    // note for jjj: This is the MatrixClient from the bot-sdk, but only allows
    // you to do actions that interact with Matrix, rather than listen for events.
    // we restrict that on purpose so that people don't add adhoc listeners to it,
    // which can easily get lost and become untracked / leaky etc.
    public readonly client: MatrixSendClient,
    // This provides the same functionality as the client, but each individual
    // request into its own capability that can be provided to keep the scope
    // of client dependencies restricted. (This really really helps when testing them).
    // It will also help if you want the actions to go through a different client if
    // say one server is down as you have suggested. Since you can easily implement
    // your own client platform.
    public readonly clientPlatform: ClientPlatform,
    // These are used to access the various revision issuers.
    public readonly roomStateManager: RoomStateManager,
    public readonly policyRoomManager: PolicyRoomManager,
    public readonly roomMembershipManager: RoomMembershipManager,
    // This gives access to the list of joined rooms and also timelien events.
    private readonly clientRooms: ClientRooms,
  ) {
    this.clientRooms.on("timeline", this.handleTimelineEventListener);
  }

  private handleTimelineEvent(roomID: StringRoomID, event: RoomEvent): void {
    this.protectedRoomsSet.handleTimelineEvent(roomID, event);
  }
}
