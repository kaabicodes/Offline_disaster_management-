export type NodeType = 'phone' | 'relay' | 'emergency' | 'lora';

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  status: 'online' | 'offline' | 'relay-only';
  battery: number;
  ipAddress?: string; // IP address for connected devices
  connectionMethod?: string;
  position: { x: number; y: number };
  connections: string[]; // IDs of connected nodes
  lastSeen: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string | 'broadcast';
  content: string;
  timestamp: number;
  type: 'text' | 'emergency' | 'data';
  hops: string[]; // Path taken by the message
  status: 'sent' | 'relaying' | 'delivered';
}

export interface MeshState {
  nodes: Node[];
  messages: Message[];
  activeRelays: number;
  isScanning: boolean;
}
