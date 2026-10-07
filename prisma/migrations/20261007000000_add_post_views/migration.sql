CREATE TABLE "PostView" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE INDEX "PostView_userId_createdAt_idx" ON "PostView"("userId", "createdAt");

ALTER TABLE "PostView"
ADD CONSTRAINT "PostView_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostView"
ADD CONSTRAINT "PostView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
