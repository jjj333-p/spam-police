// Copyright 2022 - 2024 Gnuxie <Gnuxie@protonmail.com>
// Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.
//
// SPDX-License-Identifier: AFL-3.0 AND Apache-2.0
//
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from mjolnir
// https://github.com/matrix-org/mjolnir
// </text>
// SPDX-FileAttributionText: <text>
// This modified file incorporates work from draupnir
// https://github.com/the-draupnir-project/Draupnir
// </text>

import {
  ActionResult,
  DefaultEventDecoder,
  MatrixRoomReference,
  StandardClientsInRoomMap,
  StringUserID,
  isError,
  isStringRoomAlias,
  isStringRoomID,
  isStringUserID,
} from "matrix-protection-suite";
import {
  ClientCapabilityFactory,
  MatrixSendClient,
  RoomStateManagerFactory,
  SafeMatrixEmitter,
  resolveRoomReferenceSafe,
} from "matrix-protection-suite-for-matrix-bot-sdk";
import { SpamPoliceBotFactory } from "./SpamPoliceBotFactory";
import { SpamPoliceBot } from "./SpamPoliceBot";

/**
 * This is a simple helper to create an entire the SpamPoliceBot from just
 * one bot account. In future we will want to source events from multiple clients.
 */
export async function makeSpamBotMode(
  client: MatrixSendClient,
  matrixEmitter: SafeMatrixEmitter,
  rawManagementRoom: string,
): Promise<ActionResult<SpamPoliceBot>> {
  const clientUserId = await client.getUserId();
  if (!isStringUserID(clientUserId)) {
    throw new TypeError(`${clientUserId} is not a valid mxid`);
  }
  if (
    !isStringRoomAlias(rawManagementRoom) &&
    !isStringRoomID(rawManagementRoom)
  ) {
    throw new TypeError(`${rawManagementRoom} is not a valid room id or alias`);
  }
  const configManagementRoomReference =
    MatrixRoomReference.fromRoomIDOrAlias(rawManagementRoom);
  const managementRoom = await resolveRoomReferenceSafe(
    client,
    configManagementRoomReference,
  );
  if (isError(managementRoom)) {
    // we throw because we're almost at the top level and if this is wrong, then all our code must be.
    throw managementRoom.error;
  }
  await client.joinRoom(
    managementRoom.ok.toRoomIDOrAlias(),
    managementRoom.ok.getViaServers(),
  );
  const clientsInRoomMap = new StandardClientsInRoomMap();
  const clientProvider = async (userID: StringUserID) => {
    if (userID !== clientUserId) {
      throw new TypeError(`Bot mode shouldn't be requesting any other mxids`);
    }
    return client;
  };
  const roomStateManagerFactory = new RoomStateManagerFactory(
    clientsInRoomMap,
    clientProvider,
    DefaultEventDecoder,
  );
  const clientCapabilityFactory = new ClientCapabilityFactory(clientsInRoomMap);
  const spamBotFactory = new SpamPoliceBotFactory(
    clientsInRoomMap,
    clientCapabilityFactory,
    clientProvider,
    roomStateManagerFactory,
  );
  const spamBot = await spamBotFactory.makeSpamPoliceBot(
    clientUserId,
    managementRoom.ok,
  );
  if (isError(spamBot)) {
    const error = spamBot.error;
    throw new Error(`Unable to create Draupnir: ${error.message}`);
  }
  matrixEmitter.on("room.invite", (roomID, event) => {
    // for jjj: the clientsInRoomMap handles all event ingress into MPS for us,
    // and in turn informs the various room state managers so that they are up to date
    clientsInRoomMap.handleTimelineEvent(roomID, event);
  });
  matrixEmitter.on("room.event", (roomID, event) => {
    roomStateManagerFactory.handleTimelineEvent(roomID, event);
    clientsInRoomMap.handleTimelineEvent(roomID, event);
  });
  return spamBot;
}
