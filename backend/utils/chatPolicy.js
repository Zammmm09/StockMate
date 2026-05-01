export const isAllowedChat = (senderRole, receiverRole) => {
  if (senderRole === "owner") return receiverRole === "manager" || receiverRole === "employee";
  if (senderRole === "manager") return receiverRole === "owner" || receiverRole === "employee";
  if (senderRole === "employee") return receiverRole === "manager";
  return false;
};

export const canViewChat = (viewerRole, otherRole) => {
  if (viewerRole === "owner") return otherRole === "manager" || otherRole === "employee";
  if (viewerRole === "manager") return otherRole === "owner" || otherRole === "employee";
  if (viewerRole === "employee") return otherRole === "owner" || otherRole === "manager";
  return false;
};

export const canSendChat = (senderRole, receiverRole) => isAllowedChat(senderRole, receiverRole);

export const getConversationKey = (a, b) => [String(a), String(b)].sort().join("_");