/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Wifi, 
  Bluetooth, 
  Radio, 
  Zap, 
  ShieldAlert, 
  MessageSquare, 
  Map as MapIcon, 
  Activity, 
  Battery, 
  Signal, 
  Send, 
  AlertTriangle,
  Settings,
  Plus,
  RefreshCw,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Toaster } from '@/components/ui/sonner';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Node, Message, NodeType } from './types';

// --- Constants ---
const MESH_SIZE = 600;
const NODE_COUNT = 8;
const SCAN_INTERVAL = 3000;

// --- Mock Data Generators ---
const generateInitialNodes = (): Node[] => {
  const types: NodeType[] = ['phone', 'relay', 'lora'];
  return Array.from({ length: NODE_COUNT }).map((_, i) => ({
    id: `node-${i}`,
    name: i === 0 ? 'My Device (Relay-01)' : `${types[i % 3].toUpperCase()}-${i}`,
    type: i === 0 ? 'phone' : types[i % 3],
    status: Math.random() > 0.2 ? 'online' : 'offline',
    battery: Math.floor(Math.random() * 60) + 40,
    position: {
      x: Math.random() * (MESH_SIZE - 100) + 50,
      y: Math.random() * (MESH_SIZE - 100) + 50,
    },
    connections: [],
    lastSeen: Date.now(),
  }));
};

// --- Components ---

const NodeIcon = ({ type, className }: { type: NodeType; className?: string }) => {
  switch (type) {
    case 'phone': return <Bluetooth className={className} />;
    case 'relay': return <Wifi className={className} />;
    case 'lora': return <Radio className={className} />;
    case 'emergency': return <ShieldAlert className={className} />;
    default: return <Activity className={className} />;
  }
};

export default function App() {
  const [nodes, setNodes] = useState<Node[]>(generateInitialNodes());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('mesh');
  const [newMessage, setNewMessage] = useState('');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [relayingMessageId, setRelayingMessageId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Mesh Logic ---
  
  // Update connections based on proximity
  const updateConnections = useCallback(() => {
    setNodes(prev => {
      const newNodes = [...prev];
      for (let i = 0; i < newNodes.length; i++) {
        newNodes[i].connections = [];
        for (let j = 0; j < newNodes.length; j++) {
          if (i === j) continue;
          const dist = Math.sqrt(
            Math.pow(newNodes[i].position.x - newNodes[j].position.x, 2) +
            Math.pow(newNodes[i].position.y - newNodes[j].position.y, 2)
          );
          
          // Connection range varies by type
          const range = newNodes[i].type === 'lora' ? 250 : 150;
          
          if (dist < range && newNodes[i].status === 'online' && newNodes[j].status === 'online') {
            newNodes[i].connections.push(newNodes[j].id);
          }
        }
      }
      return newNodes;
    });
  }, []);

  // Simulate scanning for new nodes
  useEffect(() => {
    if (isScanning) {
      const timer = setInterval(() => {
        updateConnections();
        // Occasionally move nodes slightly to simulate movement
        setNodes(prev => prev.map(node => {
          if (node.id === 'node-0') return node; // Keep my device static
          return {
            ...node,
            position: {
              x: Math.max(50, Math.min(MESH_SIZE - 50, node.position.x + (Math.random() * 10 - 5))),
              y: Math.max(50, Math.min(MESH_SIZE - 50, node.position.y + (Math.random() * 10 - 5))),
            }
          };
        }));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isScanning, updateConnections]);

  const handleScan = () => {
    setIsScanning(true);
    toast.info("Scanning for nearby mesh nodes...", {
      description: "Using Bluetooth and Wi-Fi Direct protocols."
    });
    setTimeout(() => setIsScanning(false), 5000);
  };

  const sendMessage = (isEmergency = false) => {
    if (!newMessage && !isEmergency) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'node-0',
      recipientId: 'broadcast',
      content: isEmergency ? "EMERGENCY: SOS BROADCAST" : newMessage,
      timestamp: Date.now(),
      type: isEmergency ? 'emergency' : 'text',
      hops: ['node-0'],
      status: 'relaying',
    };

    setMessages(prev => [msg, ...prev]);
    setNewMessage('');
    simulateRelay(msg);
  };

  const simulateRelay = async (msg: Message) => {
    setRelayingMessageId(msg.id);
    
    // Find path through mesh
    let currentPath = ['node-0'];
    let visited = new Set(['node-0']);
    
    const relayStep = async (currentId: string) => {
      const currentNode = nodes.find(n => n.id === currentId);
      if (!currentNode) return;

      const neighbors = currentNode.connections.filter(id => !visited.has(id));
      if (neighbors.length === 0) return;

      // Pick a neighbor to relay to
      const nextId = neighbors[Math.floor(Math.random() * neighbors.length)];
      visited.add(nextId);
      currentPath.push(nextId);

      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, hops: [...currentPath] } : m
      ));

      await new Promise(r => setTimeout(r, 800));
      await relayStep(nextId);
    };

    await relayStep('node-0');
    
    setMessages(prev => prev.map(m => 
      m.id === msg.id ? { ...m, status: 'delivered' } : m
    ));
    setRelayingMessageId(null);
    
    toast.success("Message relayed successfully", {
      description: `Reached ${currentPath.length - 1} nodes via mesh network.`
    });
  };

  const toggleEmergency = () => {
    setEmergencyMode(!emergencyMode);
    if (!emergencyMode) {
      toast.error("EMERGENCY MODE ACTIVATED", {
        description: "Broadcasting SOS to all nearby nodes."
      });
      sendMessage(true);
    }
  };

  const onlineNodes = nodes.filter(n => n.status === 'online').length;

  return (
    <div className="min-h-screen flex flex-col bg-mesh-bg selection:bg-mesh-primary/30">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <header className="border-b border-mesh-border px-6 py-4 flex items-center justify-between bg-mesh-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mesh-primary/10 rounded-lg border border-mesh-primary/20">
            <Radio className="w-6 h-6 text-mesh-primary animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              MeshRelay <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-mesh-primary/30 text-mesh-primary">v2.4.0-BETA</Badge>
            </h1>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-tighter">P2P Mesh Network • Offline Protocol</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 px-4 py-2 bg-zinc-900/50 rounded-full border border-mesh-border">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4 text-green-500" />
              <span className="text-xs font-mono">{onlineNodes}/{nodes.length} Nodes</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-mesh-primary" />
              <span className="text-xs font-mono">84%</span>
            </div>
          </div>
          <Button 
            variant={emergencyMode ? "destructive" : "outline"} 
            size="sm" 
            className={`font-bold gap-2 ${emergencyMode ? 'animate-pulse' : ''}`}
            onClick={toggleEmergency}
          >
            <ShieldAlert className="w-4 h-4" />
            {emergencyMode ? "SOS ACTIVE" : "EMERGENCY"}
          </Button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* Sidebar Controls */}
        <aside className="lg:col-span-3 border-r border-mesh-border p-6 space-y-6 bg-mesh-card/20 overflow-y-auto">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Network Status</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleScan}>
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <Card className="bg-mesh-card border-mesh-border">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span>Mesh Density</span>
                    <span className="text-mesh-primary">High</span>
                  </div>
                  <Progress value={75} className="h-1 bg-zinc-800" />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-mesh-border flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Relays</span>
                    <span className="text-lg font-mono font-bold">{nodes.filter(n => n.type === 'relay').length}</span>
                  </div>
                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-mesh-border flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">LoRa</span>
                    <span className="text-lg font-mono font-bold">{nodes.filter(n => n.type === 'lora').length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Protocols</h2>
            <div className="space-y-3">
              {[
                { id: 'bt', name: 'Bluetooth LE', icon: Bluetooth, active: true },
                { id: 'wifi', name: 'Wi-Fi Direct', icon: Wifi, active: true },
                { id: 'lora', name: 'LoRa Relay', icon: Radio, active: false },
              ].map(protocol => (
                <div key={protocol.id} className="flex items-center justify-between p-3 rounded-lg border border-mesh-border bg-mesh-card/40">
                  <div className="flex items-center gap-3">
                    <protocol.icon className={`w-4 h-4 ${protocol.active ? 'text-mesh-primary' : 'text-zinc-600'}`} />
                    <span className={`text-xs font-medium ${protocol.active ? 'text-zinc-200' : 'text-zinc-600'}`}>{protocol.name}</span>
                  </div>
                  <Switch checked={protocol.active} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Active Nodes</h2>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {nodes.map(node => (
                  <div key={node.id} className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-900 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${node.status === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-600'}`}>
                        <NodeIcon type={node.type} className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium truncate w-32">{node.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{node.connections.length} peers • {node.battery}%</p>
                      </div>
                    </div>
                    {node.status === 'online' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-9 flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 border-b border-mesh-border bg-mesh-card/10">
              <TabsList className="bg-transparent border-none h-14 gap-8">
                <TabsTrigger value="mesh" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-mesh-primary rounded-none px-0 h-14 gap-2">
                  <MapIcon className="w-4 h-4" /> Mesh Topology
                </TabsTrigger>
                <TabsTrigger value="messages" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-mesh-primary rounded-none px-0 h-14 gap-2">
                  <MessageSquare className="w-4 h-4" /> Communications
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-mesh-primary rounded-none px-0 h-14 gap-2">
                  <Activity className="w-4 h-4" /> Diagnostics
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 relative overflow-hidden">
              {/* Mesh Topology View */}
              <TabsContent value="mesh" className="m-0 h-full mesh-grid relative">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[800px] h-[800px] border border-mesh-border/30 rounded-full" />
                  <div className="w-[500px] h-[500px] border border-mesh-border/30 rounded-full" />
                  <div className="w-[200px] h-[200px] border border-mesh-border/30 rounded-full" />
                </div>

                {/* Connections SVG */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target) return null;
                      
                      // Check if this connection is part of an active relay
                      const isActiveRelay = messages.some(m => 
                        m.id === relayingMessageId && 
                        m.hops.includes(node.id) && 
                        m.hops.includes(targetId) &&
                        Math.abs(m.hops.indexOf(node.id) - m.hops.indexOf(targetId)) === 1
                      );

                      return (
                        <motion.line
                          key={`${node.id}-${targetId}`}
                          x1={node.position.x}
                          y1={node.position.y}
                          x2={target.position.x}
                          y2={target.position.y}
                          stroke={isActiveRelay ? "var(--color-mesh-primary)" : "rgba(39, 39, 42, 0.5)"}
                          strokeWidth={isActiveRelay ? 2 : 1}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      );
                    })
                  )}
                </svg>

                {/* Nodes */}
                {nodes.map(node => (
                  <motion.div
                    key={node.id}
                    layoutId={node.id}
                    className={`absolute cursor-pointer group z-10`}
                    style={{ left: node.position.x, top: node.position.y }}
                    initial={false}
                    animate={{ x: -20, y: -20 }}
                  >
                    <div className="relative">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300
                        ${node.id === 'node-0' ? 'bg-mesh-primary border-mesh-primary text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 
                          node.status === 'online' ? 'bg-mesh-card border-mesh-border text-zinc-300 hover:border-mesh-primary/50' : 
                          'bg-zinc-900 border-zinc-800 text-zinc-700'}
                      `}>
                        <NodeIcon type={node.type} className="w-5 h-5" />
                      </div>
                      
                      {/* Label */}
                      <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-mesh-card/80 backdrop-blur-sm border border-mesh-border px-2 py-1 rounded text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {node.name}
                      </div>

                      {/* Connection Count Badge */}
                      {node.status === 'online' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-mesh-border flex items-center justify-center text-[8px] font-bold">
                          {node.connections.length}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Map Controls Overlay */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                  <div className="bg-mesh-card/80 backdrop-blur-md border border-mesh-border p-3 rounded-lg space-y-3 w-48">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-zinc-500">Auto-Relay</span>
                      <Switch checked={true} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-zinc-500">Show Range</span>
                      <Switch checked={false} />
                    </div>
                    <Separator className="bg-mesh-border" />
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3 h-3 text-mesh-primary" />
                      <span className="text-[10px] font-mono">LAT: 34.0522 N</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3 h-3 text-mesh-primary" />
                      <span className="text-[10px] font-mono">LON: 118.2437 W</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Messages View */}
              <TabsContent value="messages" className="m-0 h-full flex flex-col">
                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-zinc-600 gap-4">
                          <MessageSquare className="w-12 h-12 opacity-20" />
                          <p className="text-sm font-mono uppercase tracking-widest">No mesh communications detected</p>
                        </div>
                      ) : (
                        messages.map(msg => (
                          <motion.div 
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex flex-col gap-2 ${msg.senderId === 'node-0' ? 'items-end' : 'items-start'}`}
                          >
                            <div className={`
                              max-w-[80%] p-4 rounded-2xl border
                              ${msg.type === 'emergency' ? 'bg-red-500/10 border-red-500/50 text-red-100' : 
                                msg.senderId === 'node-0' ? 'bg-mesh-primary/10 border-mesh-primary/30 text-zinc-100' : 
                                'bg-zinc-900 border-mesh-border text-zinc-300'}
                            `}>
                              {msg.type === 'emergency' && (
                                <div className="flex items-center gap-2 mb-2 text-red-500 font-bold text-xs uppercase tracking-tighter">
                                  <AlertTriangle className="w-3 h-3" /> SOS Broadcast
                                </div>
                              )}
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <div className="mt-3 flex items-center justify-between gap-4">
                                <span className="text-[10px] font-mono opacity-50">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className="flex items-center gap-1">
                                  {msg.status === 'relaying' ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-mesh-primary" />
                                  ) : (
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-zinc-700 text-zinc-500">
                                      {msg.hops.length - 1} HOPS
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Relay Path Visualization */}
                            <div className="flex items-center gap-1 px-2">
                              {msg.hops.map((hopId, i) => (
                                <React.Fragment key={`${msg.id}-hop-${i}`}>
                                  <span className="text-[8px] font-mono text-zinc-600">{hopId.split('-')[1]}</span>
                                  {i < msg.hops.length - 1 && <span className="text-[8px] text-zinc-800">→</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input Area */}
                  <div className="mt-6 p-4 bg-mesh-card border border-mesh-border rounded-2xl flex items-center gap-3">
                    <Input 
                      placeholder="Broadcast to mesh network..." 
                      className="bg-transparent border-none focus-visible:ring-0 text-sm"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button 
                      size="icon" 
                      className="rounded-xl bg-mesh-primary hover:bg-mesh-primary/90"
                      onClick={() => sendMessage()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Diagnostics View */}
              <TabsContent value="diagnostics" className="m-0 h-full p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-mesh-card border-mesh-border">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wider text-zinc-400">Signal Strength</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span>Bluetooth LE (2.4GHz)</span>
                          <span className="text-green-500">-42 dBm</span>
                        </div>
                        <Progress value={85} className="h-1 bg-zinc-800" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span>Wi-Fi Direct (5GHz)</span>
                          <span className="text-yellow-500">-68 dBm</span>
                        </div>
                        <Progress value={45} className="h-1 bg-zinc-800" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span>LoRa (915MHz)</span>
                          <span className="text-zinc-600">No Signal</span>
                        </div>
                        <Progress value={0} className="h-1 bg-zinc-800" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-mesh-card border-mesh-border">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wider text-zinc-400">Mesh Health</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-mesh-border">
                        <div className="flex items-center gap-3">
                          <Zap className="w-4 h-4 text-mesh-primary" />
                          <span className="text-xs font-medium">Relay Efficiency</span>
                        </div>
                        <span className="text-xs font-mono font-bold">98.2%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-mesh-border">
                        <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-mesh-primary" />
                          <span className="text-xs font-medium">Packet Loss</span>
                        </div>
                        <span className="text-xs font-mono font-bold">0.4%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-mesh-border">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="w-4 h-4 text-mesh-primary" />
                          <span className="text-xs font-medium">Avg. Hop Latency</span>
                        </div>
                        <span className="text-xs font-mono font-bold">142ms</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-mesh-card border-mesh-border md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wider text-zinc-400">System Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-black/40 rounded-lg p-4 font-mono text-[10px] space-y-1 text-zinc-500">
                        <p><span className="text-green-500">[OK]</span> Mesh protocol initialized: version 2.4.0</p>
                        <p><span className="text-zinc-400">[INFO]</span> Scanning for peers on BT_LE channel 37...</p>
                        <p><span className="text-zinc-400">[INFO]</span> Peer discovered: RELAY-3 (id: node-3)</p>
                        <p><span className="text-zinc-400">[INFO]</span> Established secure tunnel with node-3</p>
                        <p><span className="text-mesh-primary">[RELAY]</span> Inbound packet from node-3 (size: 1.2kb)</p>
                        <p><span className="text-mesh-primary">[RELAY]</span> Forwarding packet to node-5 via Wi-Fi Direct</p>
                        <p><span className="text-zinc-400">[INFO]</span> Battery level critical on node-7 (12%)</p>
                        <p><span className="text-red-500">[WARN]</span> LoRa hardware module not detected</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-mesh-border px-6 py-2 bg-mesh-card/80 backdrop-blur-md flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>MESH_READY</span>
          </div>
          <Separator orientation="vertical" className="h-3 bg-mesh-border" />
          <span>ENCRYPTION: AES-256-GCM</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UPTIME: 04:12:44</span>
          <Separator orientation="vertical" className="h-3 bg-mesh-border" />
          <span className="text-mesh-primary">RELAYING_ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}
