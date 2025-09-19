-- Real-Time Messaging System Database Migration
-- This migration adds comprehensive messaging capabilities:
-- - Chat rooms (direct, group, community, fan club)
-- - Messages with attachments and reactions
-- - Message read receipts and delivery status
-- - Room memberships and permissions
-- - Typing indicators and presence tracking

-- Chat Rooms Table
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL CHECK ("type" IN ('DIRECT', 'GROUP', 'COMMUNITY', 'FAN_CLUB')),
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "settings" JSONB DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- Chat Room Members Table
CREATE TABLE "ChatRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER' CHECK ("role" IN ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "notificationSettings" JSONB DEFAULT '{"muted": false, "mentions": true}',
    "permissions" JSONB DEFAULT '{}',
    "invitedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

-- Messages Table
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text' CHECK ("type" IN ('text', 'image', 'video', 'audio', 'file', 'system', 'announcement', 'tip', 'gift')),
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT, -- For direct messages
    "roomId" TEXT, -- For group messages
    "replyToId" TEXT, -- For message replies
    "forwardedFromId" TEXT, -- For forwarded messages
    "attachments" JSONB, -- Array of attachment objects
    "metadata" JSONB DEFAULT '{}', -- Additional message metadata
    "editHistory" JSONB DEFAULT '[]', -- Array of edit timestamps and content
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Message Reactions Table
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- Message Delivery Status Table
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent' CHECK ("status" IN ('sent', 'delivered', 'read')),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- Room Invitations Table
CREATE TABLE "RoomInvitation" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitedUser" TEXT NOT NULL,
    "invitedEmail" TEXT, -- For email invitations
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired')),
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomInvitation_pkey" PRIMARY KEY ("id")
);

-- User Presence Table
CREATE TABLE "UserPresence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline' CHECK ("status" IN ('online', 'away', 'busy', 'offline')),
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceInfo" JSONB,
    "socketIds" JSONB DEFAULT '[]', -- Array of active socket IDs
    "customStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- Blocked Users Table (for user-level blocking)
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- Message Reports Table (for moderation)
CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    "moderatorId" TEXT,
    "moderatorNotes" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

-- Add indexes for better performance
CREATE INDEX "ChatRoom_type_idx" ON "ChatRoom"("type");
CREATE INDEX "ChatRoom_createdBy_idx" ON "ChatRoom"("createdBy");
CREATE INDEX "ChatRoom_lastActivity_idx" ON "ChatRoom"("lastActivity" DESC);
CREATE INDEX "ChatRoom_isActive_idx" ON "ChatRoom"("isActive");

CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");
CREATE INDEX "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");
CREATE INDEX "ChatRoomMember_role_idx" ON "ChatRoomMember"("role");
CREATE INDEX "ChatRoomMember_joinedAt_idx" ON "ChatRoomMember"("joinedAt" DESC);
CREATE INDEX "ChatRoomMember_isActive_idx" ON "ChatRoomMember"("isActive");

CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");
CREATE INDEX "Message_roomId_idx" ON "Message"("roomId");
CREATE INDEX "Message_type_idx" ON "Message"("type");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt" DESC);
CREATE INDEX "Message_isDeleted_idx" ON "Message"("isDeleted");
CREATE INDEX "Message_isPinned_idx" ON "Message"("isPinned");
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- Composite index for room messages
CREATE INDEX "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt" DESC);
-- Composite index for direct messages
CREATE INDEX "Message_senderId_receiverId_createdAt_idx" ON "Message"("senderId", "receiverId", "createdAt" DESC);

CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");
CREATE INDEX "MessageReaction_emoji_idx" ON "MessageReaction"("emoji");

CREATE UNIQUE INDEX "MessageDelivery_messageId_userId_key" ON "MessageDelivery"("messageId", "userId");
CREATE INDEX "MessageDelivery_messageId_idx" ON "MessageDelivery"("messageId");
CREATE INDEX "MessageDelivery_userId_idx" ON "MessageDelivery"("userId");
CREATE INDEX "MessageDelivery_status_idx" ON "MessageDelivery"("status");

CREATE INDEX "RoomInvitation_roomId_idx" ON "RoomInvitation"("roomId");
CREATE INDEX "RoomInvitation_invitedBy_idx" ON "RoomInvitation"("invitedBy");
CREATE INDEX "RoomInvitation_invitedUser_idx" ON "RoomInvitation"("invitedUser");
CREATE INDEX "RoomInvitation_status_idx" ON "RoomInvitation"("status");
CREATE INDEX "RoomInvitation_expiresAt_idx" ON "RoomInvitation"("expiresAt");

CREATE UNIQUE INDEX "UserPresence_userId_key" ON "UserPresence"("userId");
CREATE INDEX "UserPresence_status_idx" ON "UserPresence"("status");
CREATE INDEX "UserPresence_lastSeen_idx" ON "UserPresence"("lastSeen" DESC);

CREATE UNIQUE INDEX "BlockedUser_blockerId_blockedId_key" ON "BlockedUser"("blockerId", "blockedId");
CREATE INDEX "BlockedUser_blockerId_idx" ON "BlockedUser"("blockerId");
CREATE INDEX "BlockedUser_blockedId_idx" ON "BlockedUser"("blockedId");

CREATE INDEX "MessageReport_messageId_idx" ON "MessageReport"("messageId");
CREATE INDEX "MessageReport_reporterId_idx" ON "MessageReport"("reporterId");
CREATE INDEX "MessageReport_status_idx" ON "MessageReport"("status");
CREATE INDEX "MessageReport_moderatorId_idx" ON "MessageReport"("moderatorId");
CREATE INDEX "MessageReport_createdAt_idx" ON "MessageReport"("createdAt" DESC);

-- Add foreign key constraints
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_invitedUser_fkey" FOREIGN KEY ("invitedUser") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add triggers for automated functionality

-- Function to update room member count
CREATE OR REPLACE FUNCTION update_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW."isActive" = true THEN
        UPDATE "ChatRoom" 
        SET "memberCount" = "memberCount" + 1 
        WHERE "id" = NEW."roomId";
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD."isActive" = true AND NEW."isActive" = false THEN
            UPDATE "ChatRoom" 
            SET "memberCount" = "memberCount" - 1 
            WHERE "id" = NEW."roomId";
        ELSIF OLD."isActive" = false AND NEW."isActive" = true THEN
            UPDATE "ChatRoom" 
            SET "memberCount" = "memberCount" + 1 
            WHERE "id" = NEW."roomId";
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD."isActive" = true THEN
        UPDATE "ChatRoom" 
        SET "memberCount" = "memberCount" - 1 
        WHERE "id" = OLD."roomId";
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for member count updates
CREATE TRIGGER update_room_member_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "ChatRoomMember"
    FOR EACH ROW EXECUTE FUNCTION update_room_member_count();

-- Function to update room last activity
CREATE OR REPLACE FUNCTION update_room_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."roomId" IS NOT NULL THEN
        UPDATE "ChatRoom" 
        SET "lastActivity" = NEW."createdAt"
        WHERE "id" = NEW."roomId";
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for room activity updates
CREATE TRIGGER update_room_last_activity_trigger
    AFTER INSERT ON "Message"
    FOR EACH ROW EXECUTE FUNCTION update_room_last_activity();

-- Function to auto-expire invitations
CREATE OR REPLACE FUNCTION auto_expire_invitations()
RETURNS void AS $$
BEGIN
    UPDATE "RoomInvitation"
    SET "status" = 'expired'
    WHERE "status" = 'pending' 
    AND "expiresAt" IS NOT NULL 
    AND "expiresAt" < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job for invitation cleanup (if using pg_cron extension)
-- SELECT cron.schedule('expire-invitations', '0 * * * *', 'SELECT auto_expire_invitations();');

-- Function to clean up old presence data
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
    UPDATE "UserPresence"
    SET "status" = 'offline'
    WHERE "status" != 'offline' 
    AND "lastSeen" < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Views for common queries

-- Active room members view
CREATE VIEW "ActiveRoomMembers" AS
SELECT 
    crm.*,
    u."name" as "userName",
    u."avatar" as "userAvatar",
    u."email" as "userEmail",
    up."status" as "presenceStatus",
    up."lastSeen" as "lastSeen"
FROM "ChatRoomMember" crm
JOIN "User" u ON crm."userId" = u."id"
LEFT JOIN "UserPresence" up ON u."id" = up."userId"
WHERE crm."isActive" = true AND crm."leftAt" IS NULL;

-- Recent messages view
CREATE VIEW "RecentMessages" AS
SELECT 
    m.*,
    u."name" as "senderName",
    u."avatar" as "senderAvatar",
    cr."name" as "roomName",
    cr."type" as "roomType",
    (
        SELECT COUNT(*)::int
        FROM "MessageReaction" mr 
        WHERE mr."messageId" = m."id"
    ) as "reactionCount",
    (
        SELECT COUNT(*)::int
        FROM "MessageDelivery" md 
        WHERE md."messageId" = m."id" AND md."status" = 'read'
    ) as "readCount"
FROM "Message" m
JOIN "User" u ON m."senderId" = u."id"
LEFT JOIN "ChatRoom" cr ON m."roomId" = cr."id"
WHERE m."isDeleted" = false
ORDER BY m."createdAt" DESC;

-- Room with last message view
CREATE VIEW "RoomsWithLastMessage" AS
SELECT 
    cr.*,
    lm."id" as "lastMessageId",
    lm."content" as "lastMessageContent",
    lm."type" as "lastMessageType",
    lm."createdAt" as "lastMessageAt",
    lm."senderName" as "lastMessageSender"
FROM "ChatRoom" cr
LEFT JOIN (
    SELECT DISTINCT ON (rm."roomId") 
        rm."id",
        rm."content",
        rm."type",
        rm."createdAt",
        rm."roomId",
        rm."senderName"
    FROM "RecentMessages" rm
    ORDER BY rm."roomId", rm."createdAt" DESC
) lm ON cr."id" = lm."roomId"
WHERE cr."isActive" = true;

-- Comments for documentation
COMMENT ON TABLE "ChatRoom" IS 'Chat rooms for different types of conversations';
COMMENT ON TABLE "ChatRoomMember" IS 'Members of chat rooms with their roles and permissions';
COMMENT ON TABLE "Message" IS 'Individual messages within rooms or direct conversations';
COMMENT ON TABLE "MessageReaction" IS 'Emoji reactions to messages';
COMMENT ON TABLE "MessageDelivery" IS 'Delivery and read status tracking for messages';
COMMENT ON TABLE "RoomInvitation" IS 'Invitations to join chat rooms';
COMMENT ON TABLE "UserPresence" IS 'Real-time presence status of users';
COMMENT ON TABLE "BlockedUser" IS 'User blocking relationships';
COMMENT ON TABLE "MessageReport" IS 'Reports of inappropriate messages for moderation';

COMMENT ON COLUMN "ChatRoom"."type" IS 'DIRECT: 1-on-1, GROUP: small groups, COMMUNITY: large public groups, FAN_CLUB: artist fan communities';
COMMENT ON COLUMN "Message"."type" IS 'Type of message content: text, media, system notifications, etc.';
COMMENT ON COLUMN "Message"."attachments" IS 'JSON array of file attachments with metadata';
COMMENT ON COLUMN "MessageDelivery"."status" IS 'Delivery status: sent, delivered, read';

-- Sample data for testing (optional)
-- INSERT INTO "ChatRoom" ("id", "name", "type", "isPrivate", "createdBy") 
-- VALUES ('test-room-1', 'General Chat', 'GROUP', false, 'user-id-here');

COMMIT;