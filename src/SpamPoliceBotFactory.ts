// Copyright 2023 - 2024 Gnuxie <Gnuxie@protonmail.com>
//
// SPDX-License-Identifier: AFL-3.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from draupnir
// https://github.com/the-draupnir-project/Draupnir
// </text>

import {
  ClientsInRoomMap,
  StringUserID,
  ActionResult,
  isError,
  StandardLoggableConfigTracker,
  MatrixRoomID,
  Ok,
} from "matrix-protection-suite";
import {
  ClientCapabilityFactory,
  RoomStateManagerFactory,
  ClientForUserID,
  joinedRoomsSafe,
} from "matrix-protection-suite-for-matrix-bot-sdk";
import { SpamPoliceBot } from "./SpamPoliceBot";
import { makeProtectedRoomsSet } from "./SpamProtectedRoomsSet";

export class SpamPoliceBotFactory {
  public constructor(
    private readonly clientsInRoomMap: ClientsInRoomMap,
    private readonly clientCapabilityFactory: ClientCapabilityFactory,
    private readonly clientProvider: ClientForUserID,
    private readonly roomStateManagerFactory: RoomStateManagerFactory,
  ) {
    // nothing to do.
  }

  public async makeSpamPoliceBot(
    clientUserID: StringUserID,
    managementRoom: MatrixRoomID,
  ): Promise<ActionResult<SpamPoliceBot>> {
    const roomStateManager =
      await this.roomStateManagerFactory.getRoomStateManager(clientUserID);
    const policyRoomManager =
      await this.roomStateManagerFactory.getPolicyRoomManager(clientUserID);
    const roomMembershipManager =
      await this.roomStateManagerFactory.getRoomMembershipManager(clientUserID);
    const client = await this.clientProvider(clientUserID);
    const clientRooms = await this.clientsInRoomMap.makeClientRooms(
      clientUserID,
      async () => joinedRoomsSafe(client),
    );
    if (isError(clientRooms)) {
      return clientRooms;
    }
    const clientPlatform = this.clientCapabilityFactory.makeClientPlatform(
      clientUserID,
      client,
    );
    const configLogTracker = new StandardLoggableConfigTracker();
    const protectedRoomsSet = await makeProtectedRoomsSet(
      managementRoom,
      roomStateManager,
      policyRoomManager,
      roomMembershipManager,
      client,
      clientPlatform,
      clientUserID,
      configLogTracker,
    );
    if (isError(protectedRoomsSet)) {
      return protectedRoomsSet;
    }
    return Ok(
      new SpamPoliceBot(
        clientUserID,
        managementRoom.toRoomIDOrAlias(),
        protectedRoomsSet.ok,
        client,
        clientPlatform,
        roomStateManager,
        policyRoomManager,
        roomMembershipManager,
        clientRooms.ok,
      ),
    );
  }
}
