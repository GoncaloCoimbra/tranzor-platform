import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/api';
import TrackingMap from '../components/TrackingMap';
import RouteSimulator from '../components/RouteSimulator';
import { Trash2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

interface Vehicle {
  id: string;
  licensePlate: string;
  driver: string;
  status: 'active' | 'inactive' | 'in_transit' | 'maintenance' | 'loading' | 'unloading';
  location: {
    lat: number;
    lng: number;
  };
  speed: number;
  destination: string;
  lastUpdate: string;
  fuel: number;
  temperature: number;
  tirePressure: number;
  odometer: number;
  load: number;
}

interface Route {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  estimatedTime: number;
  optimizedTime: number;
  estimatedFuel: number;
  optimizedFuel: number;
  savings: number;
  stops: Stop[];
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';
  difficulty: 'low' | 'medium' | 'high';
  assignedVehicle: string;
}

interface Stop {
  id: string;
  address: string;
  type: 'pickup' | 'delivery' | 'point_of_interest' | 'refuel' | 'rest';
  estimatedTime: number;
  realTime: number;
  completed: boolean;
  notes: string;
}

interface Geofence {
  id: string;
  name: string;
  type: 'danger' | 'restricted' | 'monitored' | 'preferred';
  radius: number;
  center: {
    lat: number;
    lng: number;
  };
  schedule: {
    start: string;
    end: string;
  };
  alerts: GeofenceAlert[];
}

interface GeofenceAlert {
  id: string;
  type: 'entry' | 'exit' | 'speeding' | 'long_stop' | 'maintenance' | 'fuel' | 'temperature';
  vehicle: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  action: string;
}

interface Event {
  id: string;
  type: 'trip_start' | 'trip_end' | 'stop' | 'refuel' | 'incident' | 'maintenance' | 'alert';
  vehicle: string;
  description: string;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
  };
  duration?: number;
}

const LiveTrackingRouteOptimization: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<GeofenceAlert[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [, setLiveDataError] = useState<string>('');
  const [, setLivePollError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'tracking' | 'routes' | 'geofencing' | 'history' | 'analytics'>('tracking');
  const location = useLocation();
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'grid'>('map');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  // selectedRoute tracking handled via URL parameters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statistics, setStatistics] = useState({
    totalKm: 0,
    fuelSaved: 0,
    timeSaved: 0,
    co2Avoided: 0,
    alertsResolved: 0,
    averageEfficiency: 0,
  });

  const [newRoute, setNewRoute] = useState({
    origin: '',
    destination: '',
    stops: [] as string[],
    vehicle: '',
    priority: 'normal',
    parameters: {
      avoidTolls: false,
      avoidUrbanCenters: false,
      prioritizeTime: true,
      optimizeFuel: true,
      considerTraffic: true,
      avoidHighways: false,
    }
  });

  // GPS tracking state
  const [trackingRoutes, setTrackingRoutes] = useState<any[]>([]);
  const [selectedTrackingRoute, setSelectedTrackingRoute] = useState<string | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const selectedVehicle = React.useMemo(() => 
    vehicles.find(v => String(v.id) === String(selectedVehicleId)),
    [vehicles, selectedVehicleId]
  );

  useEffect(() => {
    const loadLiveData = async () => {
      try {
        const [vRes, rRes, gRes, aRes, eRes] = await Promise.all([
          api.get('/vehicles').catch(() => ({ data: null })),
          api.get('/routes').catch(() => ({ data: null })),
          api.get('/geofences').catch(() => ({ data: null })),
          api.get('/alerts').catch(() => ({ data: null })),
          api.get('/events').catch(() => ({ data: null })),
        ]);

        let anyData = false;
        if (vRes?.data && Array.isArray(vRes.data) && vRes.data.length > 0) {
          // Ensure ID is always string para evitar problemas de compara��o
          const vehiclesClean = vRes.data.map((v: any) => ({ ...v, id: String(v.id) }));
          setVehicles(vehiclesClean);
          anyData = true;
        }
        if (rRes?.data && Array.isArray(rRes.data) && rRes.data.length > 0) { setRoutes(rRes.data); anyData = true; }
        if (gRes?.data && Array.isArray(gRes.data) && gRes.data.length > 0) { setGeofences(gRes.data); anyData = true; }
        if (aRes?.data && Array.isArray(aRes.data) && aRes.data.length > 0) { setActiveAlerts(aRes.data); anyData = true; }
        if (eRes?.data && Array.isArray(eRes.data) && eRes.data.length > 0) { setEvents(eRes.data); anyData = true; }
        if (!anyData) {
          setLiveDataError('Real date not available � no local date. Configure the backend.');
        } else {
          setLiveDataError('');
        }
      } catch (err) {
        console.error('Error loading LiveTracking date from backend:', err);
      }
    };

    loadLiveData();

    const pollInterval = setInterval(async () => {
      try {
        const vRes = await api.get('/vehicles');
        if (vRes?.data && Array.isArray(vRes.data)) {
          setVehicles(vRes.data);
          setLivePollError('');
        }
      } catch (err) {
        console.debug('Live vehicles poll failed:', err);
        setLivePollError('Failed to update vehicles in real time');
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    // When list arrives from backend, escolhe o primeiro automaticamente
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(String(vehicles[0].id));
      console.log('?? Default vehicle selected:', vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Switch tab based on query string (�til para links de footer/sidebar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const veh = params.get('vehicle');
    if (tab && ['tracking','routes','geofencing','history','analytics'].includes(tab)) {
      setActiveTab(tab as any);
      console.log('?? Tab set by query string:', tab);
    }
    if (veh && vehicles.length > 0) {
      const match = vehicles.find(v => String(v.id) === String(veh));
      if (match) {
        setSelectedVehicleId(String(match.id));
        console.log('?? Vehicle selected via query:', match.id);
      }
    }
  }, [location.search]);

  useEffect(() => {
    const totalFuelSaved = routes.reduce((acc, route) => acc + (route.estimatedFuel - route.optimizedFuel), 0);
    const totalTimeSaved = routes.reduce((acc, route) => acc + (route.estimatedTime - route.optimizedTime), 0);
    const co2Avoided = totalFuelSaved * 2.68;
    const alertasResolvidos = activeAlerts.filter(a => a.resolved).length;
    const averageEfficiency = vehicles.length > 0
      ? vehicles.reduce((acc, v) => acc + (v.fuel / v.odometer * 100), 0) / vehicles.length
      : 0;

    setStatistics(prev => ({
      ...prev,
      fuelSaved: parseFloat(totalFuelSaved.toFixed(1)),
      timeSaved: Math.round(totalTimeSaved),
      co2Avoided: parseFloat(co2Avoided.toFixed(1)),
      alertasResolvidos,
      averageEfficiency: parseFloat(averageEfficiency.toFixed(2)),
    }));
  }, [routes, activeAlerts, vehicles]);

  // Load GPS tracking routes
  useEffect(() => {
    const loadTrackingRoutes = async () => {
      try {
        const res = await api.get('/transports/tracking-routes/all').catch(() => ({ data: [] }));
        if (res?.data && Array.isArray(res.data)) {
          setTrackingRoutes(res.data);
          console.log('? Tracking routes loaded:', res.data.length);
        }
      } catch (err) {
        console.error('Error loading tracking routes:', err);
        setTrackingRoutes([]);
      }
    };

    loadTrackingRoutes();
  }, []);

  // Se h� transport id na querystring, selecionar route correspondente
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const transportId = params.get('transport');
    const vehicleId = params.get('vehicle');
    
    if (transportId && trackingRoutes.length > 0) {
      // Procurar pela route usando v�rias propriedades poss�veis (id, transportId, transport.id)
      const match = trackingRoutes.find(r =>
        String(r.id) === String(transportId) ||
        String((r as any).transportId) === String(transportId) ||
        String((r as any).transport?.id) === String(transportId)
      );

      if (match) {
        setSelectedTrackingRoute(match.id);
        setActiveTab('history'); // Mudar para aba de hist�rico/rastreamento
        console.log('?? Transport route found for simulation:', match.id);
        console.log('?? Origin:', match.origin, '? Destination:', match.destination);
        console.log('?? Locations:', match.locations?.length || 0);
      } else {
        console.warn(`?? Transport ${transportId} not found in tracking routes`);
        console.warn('Available routes:', trackingRoutes.map(r => ({ id: r.id, transportId: (r as any).transportId || (r as any).transport?.id || null, name: r.name })));
      }
    }
    
    // If vehicleId exists, also select the vehicle
    if (vehicleId && vehicles.length > 0) {
      const vehicleMatch = vehicles.find(v => String(v.id) === String(vehicleId));
      if (vehicleMatch) {
        setSelectedVehicleId(String(vehicleMatch.id));
        console.log('?? Vehicle selected via transport:', vehicleMatch.id);
      }
    }
  }, [location.search, trackingRoutes, vehicles]);

  // Deletar todo o rastreamento GPS
  const handleClearAllTracking = async () => {
    setIsDeleteLoading(true);
    try {
      await api.delete('/transports/tracking-routes/clear-all');
      setTrackingRoutes([]);
      setSelectedTrackingRoute(undefined);
      setShowDeleteConfirm(false);
      alert('? GPS tracking successfully deleted!');
    } catch (error: any) {
      console.error('Error deleting tracking:', error);
      const msg = error.response?.data?.message || 'Error deleting GPS tracking. Please try again.';
      alert('? ' + msg);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Deletar rastreamento de uma route espec�fica
  const handleDeleteRoute = async (routeId: string) => {
    try {
      await api.delete(`/transports/tracking-routes/${routeId}`);
      setTrackingRoutes(prev => prev.filter(r => r.id !== routeId));
      if (selectedTrackingRoute === routeId) {
        setSelectedTrackingRoute(undefined);
      }
      alert('Route successfully deleted!');
    } catch (error: any) {
      console.error('Error deleting route:', error);
      const msg = error.response?.data?.message || 'Error deleting route. Please try again.';
      alert(msg);
    }
  };

  

  const getStatusColor = (status: Vehicle['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'in_transit': return 'bg-red-500';
      case 'loading': return 'bg-purple-500';
      case 'unloading': return 'bg-indigo-500';
      case 'inactive': return 'bg-gray-500';
      case 'maintenance': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: Vehicle['status']) => {
    switch (status) {
      case 'active': return 'Available';
      case 'in_transit': return 'On Trip';
      case 'loading': return 'Loading';
      case 'unloading': return 'Unloading';
      case 'inactive': return 'Inactive';
      case 'maintenance': return 'Maintenance';
      default: return status;
    }
  };

  const getPriorityColor = (priority: GeofenceAlert['priority']) => {
    switch (priority) {
      case 'low': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertLabel = (type: GeofenceAlert['type']) => {
    switch (type) {
      case 'speeding': return 'SPD';
      case 'entry': return 'ENT';
      case 'exit': return 'EXT';
      case 'long_stop': return 'STP';
      case 'maintenance': return 'MNT';
      case 'fuel': return 'FUL';
      case 'temperature': return 'TMP';
      default: return 'ALT';
    }
  };

  const getDifficultyColor = (difficulty: Route['difficulty']) => {
    switch (difficulty) {
      case 'low': return 'bg-emerald-500';
      case 'medium': return 'bg-amber-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventLabel = (type: Event['type']) => {
    switch (type) {
      case 'trip_start': return 'STR';
      case 'trip_end': return 'END';
      case 'stop': return 'STP';
      case 'refuel': return 'REF';
      case 'incident': return 'INC';
      case 'maintenance': return 'MNT';
      case 'alert': return 'ALT';
      default: return '---';
    }
  };

  const getEventColor = (type: Event['type']) => {
    switch (type) {
      case 'trip_start': return 'bg-red-600';
      case 'trip_end': return 'bg-emerald-600';
      case 'stop': return 'bg-slate-600';
      case 'refuel': return 'bg-amber-600';
      case 'incident': return 'bg-red-600';
      case 'maintenance': return 'bg-orange-600';
      case 'alert': return 'bg-red-700';
      default: return 'bg-slate-600';
    }
  };

  const getGeofenceTypeLabel = (type: Geofence['type']) => {
    switch (type) {
      case 'danger': return 'DANGER';
      case 'restricted': return 'RESTRICTED';
      case 'preferred': return 'PREFERRED';
      case 'monitored': return 'MONITORED';
      default: return type;
    }
  };

  const getGeofenceColor = (type: Geofence['type']) => {
    switch (type) {
      case 'danger': return 'bg-red-500';
      case 'restricted': return 'bg-amber-500';
      case 'preferred': return 'bg-emerald-500';
      default: return 'bg-red-500';
    }
  };

  const handleOptimizeRoute = () => {
    if (!newRoute.origin || !newRoute.destination || !newRoute.vehicle) {
      alert('Please fill in all required fields!');
      return;
    }

    const distance = 150 + Math.random() * 450;
    const estimatedTime = (distance / 60) * 60;
    const savings = newRoute.parameters.optimizeFuel ? 0.25 : 0.15;
    const optimizedTime = estimatedTime * (1 - savings);
    const estimatedFuel = distance * 0.12;
    const optimizedFuel = estimatedFuel * (1 - savings);

    const selectedVehicle = vehicles.find(v => v.licensePlate === newRoute.vehicle);

    const optimizedNewRoute: Route = {
      id: Date.now().toString(),
      origin: newRoute.origin,
      destination: newRoute.destination,
      distance: Math.round(distance),
      estimatedTime: Math.round(estimatedTime),
      optimizedTime: Math.round(optimizedTime),
      estimatedFuel: parseFloat(estimatedFuel.toFixed(1)),
      optimizedFuel: parseFloat(optimizedFuel.toFixed(1)),
      savings: parseFloat((savings * 100).toFixed(1)),
      stops: newRoute.stops.map((stop, index) => ({
        id: (index + 1).toString(),
        address: stop,
        type: 'delivery',
        estimatedTime: 15 + Math.random() * 30,
        realTime: 0,
        completed: false,
        notes: newRoute.priority === 'high' ? 'High priority' : 'Standard delivery'
      })),
      status: 'planned',
      difficulty: distance > 400 ? 'high' : distance > 200 ? 'medium' : 'low',
      assignedVehicle: newRoute.vehicle
    };

    setRoutes([...routes, optimizedNewRoute]);
    setNewRoute({
      origin: '',
      destination: '',
      stops: [],
      vehicle: '',
      priority: 'normal',
      parameters: {
        avoidTolls: false,
        avoidUrbanCenters: false,
        prioritizeTime: true,
        optimizeFuel: true,
        considerTraffic: true,
        avoidHighways: false,
      }
    });

    const  newEvent: Event = {
      id: Date.now().toString(),
      type: 'trip_start',
      vehicle: newRoute.vehicle,
      description: `New optimized route: ${newRoute.origin} ? ${newRoute.destination}`,
      timestamp: new Date().toISOString(),
      location: selectedVehicle?.location || { lat: 0, lng: 0 }
    };

    setEvents(prev => [ newEvent, ...prev.slice(0, 9)]);
  };

  const handleResolveAlert = (alertId: string) => {
    setActiveAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  };

  const handleStartRoute = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    setRoutes(prev => prev.map(r =>
      r.id === routeId ? { ...r, status: 'in_progress' } : r
    ));

    setVehicles(prev => prev.map(v =>
      v.licensePlate === route.assignedVehicle ? { ...v, status: 'in_transit', destination: route.destination } : v
    ));
  };

  const filteredVehicles = statusFilter === 'all'
    ? vehicles
    : vehicles.filter(v => v.status === statusFilter);

  return (
    <div className="operations-page" style={{ fontFamily: "'Outfit', -apple-system, sans-serif", background: '#111214', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1a2234' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#f0f4ff' }}>
              GPS Tracking & Route Optimization
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#3a4d63' }}>
              {t('tracking')} · Route intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: '#07090f', border: '1px solid #1a2234', color: '#7a8fa8' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#dc2626' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Active Vehicles: {vehicles.filter(v => v.status === 'in_transit').length}/{vehicles.length}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Main Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-900/30 via-emerald-800/20 to-emerald-900/10 border-2 border-emerald-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-300">Total Savings</p>
                <p className="text-2xl font-bold text-white">{statistics.fuelSaved}L</p>
                <p className="text-xs text-emerald-400/70 mt-1">Fuel saved</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">SAV</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/10 border-2 border-red-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-300">Time Saved</p>
                <p className="text-2xl font-bold text-white">{statistics.timeSaved}h</p>
                <p className="text-xs text-red-400/70 mt-1">Optimized hours</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">TIM</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 via-purple-800/20 to-purple-900/10 border-2 border-purple-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-300">CO2 Avoided</p>
                <p className="text-2xl font-bold text-white">{statistics.co2Avoided}kg</p>
                <p className="text-xs text-purple-400/70 mt-1">Environmental reduction</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">CO2</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/30 via-amber-800/20 to-amber-900/10 border-2 border-amber-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-300">Average Efficiency</p>
                <p className="text-2xl font-bold text-white">{statistics.averageEfficiency}%</p>
                <p className="text-xs text-amber-400/70 mt-1">Fleet performance</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">EFF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        {activeAlerts.filter(a => !a.resolved).length > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-900/40 via-red-800/30 to-red-900/20 border-2 border-red-500/40 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center animate-pulse">
                    <span className="text-xs font-bold text-white">ALT</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-400">Active Alerts</h3>
                    <p className="text-sm text-slate-300">
                      {activeAlerts.filter(a => !a.resolved).length} alerts require attention
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveAlerts([])}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all font-medium"
                  >
                    Resolve All
                  </button>
                  <button
                    onClick={() => setActiveTab('tracking')}
                    className="px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white rounded-lg transition-all font-medium"
                  >
                    View Map
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeAlerts.filter(a => !a.resolved).map(alert => (
                  <div key={alert.id} className="bg-slate-900/60 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1">
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${getPriorityColor(alert.priority)}`}>
                          <span className="text-xs font-bold text-white">{getAlertLabel(alert.type)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getPriorityColor(alert.priority)}`}>
                              {alert.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-400">{alert.vehicle}</span>
                          </div>
                          <p className="text-sm font-medium text-white mb-1">{alert.message}</p>
                          <p className="text-xs text-slate-400">Action: {alert.action}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Tabs */}
          <div style={{ background: '#0d1117', border: '1px solid #1a2234', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <div style={{ borderBottom: '1px solid #1a2234' }} className="flex flex-wrap">
              {(['tracking', 'routes', 'geofencing', 'history', 'analytics'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 min-w-[140px] px-4 py-3 text-sm font-bold transition-all relative ${
                    activeTab === tab
                      ? 'text-red-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: activeTab === tab ? '#1a2a4a' : 'transparent',
                    borderBottom: activeTab === tab ? '2px solid #dc2626' : 'none',
                    paddingBottom: activeTab === tab ? 'calc(0.75rem - 2px)' : '0.75rem'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    {tab === 'tracking' && 'Live Tracking'}
                    {tab === 'routes' && 'Route Intelligence'}
                    {tab === 'geofencing' && 'Control Zones'}
                    {tab === 'history' && 'History & Events'}
                    {tab === 'analytics' && 'Analytics'}
                  </div>
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-cyan-500"></div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 md:p-6">
              {activeTab === 'tracking' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{t('tracking')}</h3>
                      <p className="text-sm text-slate-400">View GPS tracking routes</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                        <button
                          onClick={() => setViewMode('map')}
                          className={`px-4 py-2 text-sm ${viewMode === 'map' ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'}`}
                        >
                          Map
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`px-4 py-2 text-sm ${viewMode === 'list' ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'}`}
                        >
                          List
                        </button>
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`px-4 py-2 text-sm ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'}`}
                        >
                          Grid
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-4 py-2 bg-slate-800 border-2 border-red-500/30 rounded-lg text-white focus:border-red-500 focus:outline-none"
                    >
                      <option value="todos">All Status</option>
                      <option value="em_viagem">On Trip</option>
                      <option value="active">Available</option>
                      <option value="carregando">Loading</option>
                      <option value="descarga">Unloading</option>
                      <option value="maintenance">Maintenance</option>
                    </select>

                    <select
                      value={selectedVehicleId || ''}
                      onChange={(e) => setSelectedVehicleId(e.target.value || null)}
                      disabled={vehicles.length === 0}
                      className="px-4 py-2 bg-slate-800 border-2 border-purple-500/30 rounded-lg text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {vehicles.length === 0 ? 'No vehicles available' : 'Select Vehicle...'}
                      </option>
                      {vehicles.map(v => (
                        <option key={v.id} value={String(v.id)}>
                          {v.licensePlate} - {v.driver} ({getStatusText(v.status)})
                        </option>
                      ))}
                    </select>

                    {selectedVehicle && (
                      <button
                        onClick={() => {
                          if (selectedVehicle) {
                            const routesVehicle = trackingRoutes.filter(r => 
                              String(r.vehicle?.id) === String(selectedVehicle) || String(r.vehicleId) === String(selectedVehicle)
                            );
                            if (routesVehicle.length > 0) {
                              setSelectedTrackingRoute(routesVehicle[0].id);
                              setViewMode('map');
                            } else {
                              alert('No tracking route found for this vehicle');
                            }
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Route
                      </button>
                    )}
                  </div>

                  {/* Map */}
                  {viewMode === 'map' && (
                    <div className="relative bg-gradient-to-br from-slate-900 to-gray-950 rounded-xl h-[500px] border-2 border-red-500/30 overflow-hidden">
                      {trackingRoutes.length > 0 ? (
                        <TrackingMap
                          routes={trackingRoutes.map(r => ({
                            id: r.id,
                            name: r.name || r.origin + ' ? ' + r.destination,
                            locations: r.locations || [],
                            status: (r.status === 'in_transit' || r.status === 'pending' || r.status === 'completed') 
                              ? r.status as 'in_progress' | 'pending' | 'completed'
                              : 'pending' as const
                          }))}
                          selectedRouteId={selectedTrackingRoute}
                          onRouteSelect={setSelectedTrackingRoute}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <p className="text-slate-400">No tracking routes available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* List */}
                  {viewMode === 'list' && (
                    <div className="space-y-4">
                      {filteredVehicles.map(vehicle => (
                        <div key={vehicle.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-red-500/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 ${getStatusColor(vehicle.status)} rounded-xl flex items-center justify-center`}>
                                <span className="text-xs font-bold text-white">VEH</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-white text-lg">{vehicle.licensePlate}</p>
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(vehicle.status)}`}>
                                    {getStatusText(vehicle.status)}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-300">{vehicle.driver}</p>
                                <p className="text-xs text-slate-400">Destination: {vehicle.destination}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white text-xl">{vehicle.speed} km/h</p>
                              <p className="text-sm text-slate-400">{vehicle.fuel}% fuel</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-slate-400">Temperature</p>
                              <p className={`font-bold ${vehicle.temperature > 90 ? 'text-red-400' : 'text-white'}`}>
                                {vehicle.temperature}�C
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Tire Pressure</p>
                              <p className="font-bold text-white">{vehicle.tirePressure} PSI</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Odometer</p>
                              <p className="font-bold text-white">{vehicle.odometer != null ? vehicle.odometer.toLocaleString() : 'N/A'} km</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Last Update</p>
                              <p className="font-bold text-white">
                                {vehicle.lastUpdate ? `${Math.floor((Date.now() - new Date(vehicle.lastUpdate).getTime()) / 60000)} min` : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grid */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredVehicles.map(vehicle => (
                        <div key={vehicle.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-slate-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(vehicle.status)}`}></div>
                              <span className="font-bold text-white">{vehicle.licensePlate}</span>
                            </div>
                            <span className="text-xs text-slate-400">{vehicle.speed} km/h</span>
                          </div>
                          <p className="text-sm text-slate-300 mb-2">{vehicle.driver}</p>
                          <p className="text-xs text-slate-400 mb-3">{vehicle.destination}</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Fuel</span>
                              <span className="font-bold text-white">{vehicle.fuel}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${vehicle.fuel < 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${vehicle.fuel}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Vehicle Details */}
                  {selectedVehicleId && selectedVehicle && (
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-xl p-6 border-2 border-red-500/30">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-xl font-bold text-red-400">Vehicle Diagnostics</h4>
                          <p className="text-sm text-slate-400">Complete real-time analysis</p>
                        </div>
                        <button
                          onClick={() => setSelectedVehicleId(null)}
                          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                        >
                          ?
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-400">Identification</p>
                            <div className="mt-2 space-y-2">
                              <p className="text-white font-medium">{selectedVehicle.licensePlate}</p>
                              <p className="text-slate-300">{selectedVehicle.driver}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Current Location</p>
                            <p className="text-white font-medium mt-2">
                              {selectedVehicle.location?.lat != null ? selectedVehicle.location.lat.toFixed(6) : 'N/A'}, {selectedVehicle.location?.lng != null ? selectedVehicle.location.lng.toFixed(6) : 'N/A'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">GPS Coordinates</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-400">Performance</p>
                            <div className="mt-2 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-2xl font-bold text-white">{selectedVehicle.speed}</p>
                                <p className="text-xs text-slate-400">km/h</p>
                              </div>
                              <div>
                                <p className="text-2xl font-bold text-white">{selectedVehicle.fuel}%</p>
                                <p className="text-xs text-slate-400">Fuel</p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Odometer</p>
                            <p className="text-xl font-bold text-white mt-2">
                              {selectedVehicle.odometer != null ? selectedVehicle.odometer.toLocaleString() : 'N/A'} km
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-400">Conditions</p>
                            <div className="mt-2 space-y-3">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs text-slate-400">Engine Temperature</span>
                                  <span className={`text-xs font-bold ${selectedVehicle.temperature > 90 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {selectedVehicle.temperature}�C
                                  </span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${selectedVehicle.temperature > 90 ? 'bg-red-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, selectedVehicle.temperature)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs text-slate-400">Tire Pressure</span>
                                  <span className="text-xs font-bold text-white">{selectedVehicle.tirePressure} PSI</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full bg-emerald-500"
                                    style={{ width: `${(selectedVehicle.tirePressure / 40) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-700">
                        <div className="flex gap-3">
                          <button
                            onClick={() => alert('Contact driver functionality not yet implemented')}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                          >
                            Contact Driver
                          </button>
                          <button
                            onClick={() => alert('View history will go to history page when available')}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                          >
                            View History
                          </button>
                          <button
                            onClick={() => alert('Maintenance scheduling not yet enabled')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
                          >
                            Schedule Maintenance
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'routes' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-emerald-900/20 via-emerald-800/15 to-emerald-900/10 rounded-xl p-6 border-2 border-emerald-500/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="text-xl font-bold text-emerald-400">Optimization Engine</h4>
                        <p className="text-sm text-slate-400">Calculate the most efficient route with AI</p>
                      </div>
                      <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs font-bold text-emerald-300 border border-emerald-500/30">
                        AI ACTIVE
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">Origin *</label>
                        <Input type="text" 
                          value={newRoute.origin}
                          onChange={(e) => setNewRoute({...newRoute, origin: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-800 border-2 border-emerald-500/30 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                          placeholder="Origin address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">Destination *</label>
                        <Input type="text" 
                          value={newRoute.destination}
                          onChange={(e) => setNewRoute({...newRoute, destination: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-800 border-2 border-emerald-500/30 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                          placeholder="Destination address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-300 mb-2">Vehicle *</label>
                        <select
                          value={newRoute.vehicle}
                          onChange={(e) => setNewRoute({...newRoute, vehicle: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-800 border-2 border-emerald-500/30 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Select vehicle</option>
                          {vehicles.filter(v => v.status === 'active' || v.status === 'in_transit').map(v => (
                            <option key={v.id} value={v.licensePlate}>
                              {v.licensePlate} - {v.driver} ({v.fuel}%)
                            </option>
                          ))}
                        </select>
                        {vehicles.filter(v => v.status === 'active' || v.status === 'in_transit').length === 0 && (
                          <p className="text-xs text-yellow-400 mt-1">
                            No active or on-trip vehicles. Change status in <Link to="/vehicles" className="underline">Vehicles</Link> to assign.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-slate-300 mb-2">Intermediate Stops</label>
                      <div className="space-y-3">
                        {newRoute.stops.map((stop, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs text-slate-300">
                              {index + 1}
                            </div>
                            <Input type="text" 
                              value={stop}
                              onChange={(e) => {
                                const novasParadas = [...newRoute.stops];
                                novasParadas[index] = e.target.value;
                                setNewRoute({...newRoute, stops: novasParadas});
                              }}
                              className="flex-1 px-4 py-2 bg-slate-800 border-2 border-emerald-500/30 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                              placeholder={`Stop ${index + 1}`}
                            />
                            <button
                              onClick={() => {
                                const novasParadas = newRoute.stops.filter((_, i) => i !== index);
                                setNewRoute({...newRoute, stops: novasParadas});
                              }}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setNewRoute({...newRoute, stops: [...newRoute.stops, '']})}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          + Add Stop
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                      {[
                        { key: 'evitarPedagios', label: 'Avoid Tolls' },
                        { key: 'evitarCentrosUrbanos', label: 'Avoid Urban Centers' },
                        { key: 'priorizarTempo', label: 'Prioritize Time' },
                        { key: 'otimizarCombustivel', label: 'Optimize Fuel' },
                        { key: 'considerarTransito', label: 'Real Traffic' },
                        { key: 'evitarEstradasPercursos', label: 'Avoid Bad Roads' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newRoute.parameters[key as keyof typeof newRoute.parameters]}
                            onChange={(e) => setNewRoute({
                              ...newRoute,
                              parameters: { ...newRoute.parameters, [key]: e.target.checked }
                            })}
                            className="w-4 h-4 accent-emerald-500"
                          />
                          <span className="text-sm text-slate-300">{label}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleOptimizeRoute}
                      className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
                    >
                      CALCULATE OPTIMIZED ROUTE
                      <div className="text-sm font-normal opacity-90 mt-1">
                        Estimated savings: 20�30% on operational costs
                      </div>
                    </button>
                  </div>

                  {/* Existing Routes */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-white">Routes in Progress</h3>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">All</button>
                        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">In Progress</button>
                        <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm">Planned</button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {routes.map(route => (
                        <div key={route.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-5 border border-slate-700 hover:border-red-500/50 transition-all">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getDifficultyColor(route.difficulty)}`}>
                                  {route.difficulty.toUpperCase()}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  route.status === 'completed' ? 'bg-emerald-900/30 text-emerald-300' :
                                  route.status === 'in_progress' ? 'bg-red-900/30 text-red-300' :
                                  route.status === 'delayed' ? 'bg-red-900/30 text-red-300' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {route.status === 'completed' ? 'COMPLETED' :
                                   route.status === 'in_progress' ? 'IN PROGRESS' :
                                   route.status === 'delayed' ? 'DELAYED' : 'PLANNED'}
                                </span>
                              </div>
                              <h5 className="font-bold text-white text-lg">
                                {route.origin} ? {route.destination}
                              </h5>
                              <p className="text-sm text-slate-400">Vehicle: {route.assignedVehicle} � {route.stops.length} stops</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-emerald-400">{route.savings}%</p>
                              <p className="text-xs text-slate-400">Estimated savings</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                            <div className="text-center">
                              <p className="text-sm text-slate-400">Distance</p>
                              <p className="font-bold text-white text-xl">{route.distance} km</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-slate-400">Original Time</p>
                              <p className="font-bold text-white text-xl">{route.estimatedTime} min</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-slate-400">Optimized Time</p>
                              <p className="font-bold text-emerald-400 text-xl">{route.optimizedTime} min</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-slate-400">Fuel</p>
                              <p className="font-bold text-white text-xl">
                                <span className="line-through text-slate-500 mr-2">{route.estimatedFuel}L</span>
                                <span className="text-emerald-400">{route.optimizedFuel}L</span>
                              </p>
                            </div>
                          </div>

                          <div className="mb-5">
                            <p className="text-sm font-bold text-slate-300 mb-3">Scheduled Stops:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {route.stops.map(stop => (
                                <div key={stop.id} className={`bg-slate-900/60 rounded-lg p-3 border ${stop.completed ? 'border-emerald-500/30' : 'border-slate-700'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${stop.completed ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                      <span className="text-sm font-medium text-white">{stop.type.toUpperCase()}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{stop.estimatedTime} min</span>
                                  </div>
                                  <p className="text-sm text-slate-300 mb-2">{stop.address}</p>
                                  <p className="text-xs text-slate-500">{stop.notes}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {route.status === 'planned' && (
                              <button
                                onClick={() => handleStartRoute(route.id)}
                                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-medium"
                              >
                                Start Route
                              </button>
                            )}
                            <button
                              onClick={() => alert('"View Details" functionality not yet available')}
                              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => alert('Export currently unavailable')}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-medium"
                            >
                              Export Route
                            </button>
                            {route.status === 'in_progress' && (
                              <button className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg font-medium">
                                Live Tracking
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'geofencing' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white">Zone Management</h3>
                      <p className="text-sm text-slate-400">Configure monitoring and restriction areas</p>
                    </div>
                    <button className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg">
                      New Zone
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {geofences.map(geofence => (
                      <div key={geofence.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getGeofenceColor(geofence.type)}`}>
                              <span className="text-xs font-bold text-white">{getGeofenceTypeLabel(geofence.type).slice(0, 3)}</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-white">{geofence.name}</h5>
                              <p className="text-xs text-slate-400">{getGeofenceTypeLabel(geofence.type)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{geofence.radius}m</p>
                            <p className="text-xs text-slate-400">radius</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Location</p>
                            <p className="text-sm text-slate-300">
                              {geofence.center?.lat != null ? geofence.center.lat.toFixed(6) : 'N/A'}, {geofence.center?.lng != null ? geofence.center.lng.toFixed(6) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Active Hours</p>
                            <p className="text-sm text-slate-300">
                              {geofence.schedule.start} - {geofence.schedule.end}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Recent Alerts</p>
                            {geofence.alerts.length > 0 ? (
                              <div className="space-y-1">
                                {geofence.alerts.slice(0, 2).map(alert => (
                                  <div key={alert.id} className="text-xs bg-slate-900/50 rounded p-2">
                                    <div className="flex justify-between">
                                      <span className="text-slate-300">{alert.vehicle}</span>
                                      <span className="text-slate-500">{new Date(alert.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-400 mt-1">{alert.message}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No alerts recorded</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 flex gap-2">
                          <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">Edit</button>
                          <button className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Monitor</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white">GPS Tracking History</h3>
                      <p className="text-sm text-slate-400">View and manage transport route history</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-all"
                      >
                        <Trash2 size={16} /> Delete All
                      </button>
                    </div>
                  </div>

                  {/* Confirmation Modal */}
                  {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm">
                        <p className="text-white font-bold mb-4">Confirm Deletion</p>
                        <p className="text-slate-300 mb-6">Are you sure you want to delete all GPS tracking? This action cannot be undone.</p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClearAllTracking}
                            disabled={isDeleteLoading}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                          >
                            {isDeleteLoading ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Map of Routes */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700 overflow-hidden" style={{ height: '400px' }}>
                    {trackingRoutes.length > 0 ? (
                      <TrackingMap
                        routes={trackingRoutes.map(r => ({
                          id: r.id,
                          name: r.name || r.origin + ' ? ' + r.destination,
                          locations: r.locations || [],
                          status: r.status || 'pending'
                        }))}
                        selectedRouteId={selectedTrackingRoute}
                        onRouteSelect={setSelectedTrackingRoute}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-slate-400">No tracking routes available</p>
                      </div>
                    )}
                  </div>

                  {/* Route Simulator */}
                  {selectedTrackingRoute && trackingRoutes.find(r => r.id === selectedTrackingRoute) && (
                    <RouteSimulator
                      route={trackingRoutes.find(r => r.id === selectedTrackingRoute)}
                      onSimulationUpdate={(progress, location) => {
                        console.log('Simulation in progress:', progress, location);
                      }}
                    />
                  )}

                  {/* List of Routes */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-sm">Tracked Routes ({trackingRoutes.length})</h4>
                    <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                      {trackingRoutes.map(route => (
                        <div
                          key={route.id}
                          onClick={() => setSelectedTrackingRoute(route.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedTrackingRoute === route.id
                              ? 'bg-red-600/20 border-red-500'
                              : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <MapPin size={16} className="text-red-400" />
                                <p className="font-medium text-white">{route.origin} ? {route.destination}</p>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">ID: {route.id}</p>
                              <div className="flex gap-4 mt-2">
                                <span className="text-xs text-slate-400">
                                  <strong>Points:</strong> {route.locations?.length || 0}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  route.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                  route.status === 'in_progress' ? 'bg-red-500/20 text-red-400' :
                                  'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {route.status}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRoute(route.id);
                              }}
                              className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Event Log */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700">
                    <div className="p-4 border-b border-slate-700">
                      <h4 className="text-lg font-bold text-white">Event Log</h4>
                      <p className="text-sm text-slate-400">Complete activity history</p>
                    </div>
                    <div className="p-4 border-b border-slate-700">
                      <div className="grid grid-cols-12 text-xs font-bold text-slate-400">
                        <div className="col-span-1">Type</div>
                        <div className="col-span-3">Vehicle</div>
                        <div className="col-span-4">Description</div>
                        <div className="col-span-2">Time</div>
                        <div className="col-span-2">Duration</div>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                      {events.map(event => (
                        <div key={event.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                          <div className="grid grid-cols-12 items-center">
                            <div className="col-span-1">
                              <div className={`w-8 h-8 rounded flex items-center justify-center ${getEventColor(event.type)}`}>
                                <span className="text-xs font-bold text-white">{getEventLabel(event.type)}</span>
                              </div>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-white">{event.vehicle}</p>
                            </div>
                            <div className="col-span-4">
                              <p className="text-slate-300">{event.description}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm text-slate-400">
                                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm text-slate-400">
                                {event.duration ? `${event.duration} min` : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Performance Analysis</h3>
                    <p className="text-sm text-slate-400">Advanced metrics and predictive insights</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700">
                      <h4 className="text-lg font-bold text-white mb-4">Efficiency by Vehicle</h4>
                      <div className="space-y-4">
                        {vehicles.map(vehicle => (
                          <div key={vehicle.id}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-slate-300">{vehicle.licensePlate}</span>
                              <span className="text-sm font-bold text-white">
                                {((vehicle.odometer / vehicle.fuel) * 10).toFixed(2)} km/L
                              </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-red-500 to-emerald-500"
                                style={{ width: `${Math.min(100, (vehicle.odometer / 200000) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700">
                      <h4 className="text-lg font-bold text-white mb-4">Alert Distribution</h4>
                      <div className="space-y-4">
                        {[
                          { label: 'Speed', pct: 45, color: 'bg-red-500' },
                          { label: 'Zones', pct: 30, color: 'bg-amber-500' },
                          { label: 'Maintenance', pct: 15, color: 'bg-red-500' },
                          { label: 'Other', pct: 10, color: 'bg-purple-500' },
                        ].map(({ label, pct, color }) => (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-slate-300">{label}</span>
                              <span className="text-sm font-bold text-white">{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700">
                    <h4 className="text-lg font-bold text-white mb-4">Predictions and Insights</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-emerald-400">MNT</span>
                          </div>
                          <div>
                            <p className="font-medium text-white">Predictive Maintenance</p>
                            <p className="text-sm text-slate-400">Vehicle DD-33-33 requires maintenance in 7 days</p>
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">
                          Schedule
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-red-400">OPT</span>
                          </div>
                          <div>
                            <p className="font-medium text-white">Route Optimization</p>
                            <p className="text-sm text-slate-400">Potential additional savings: 12%</p>
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                          Optimize
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>{/* closes p-4 md:p-6 */}
          </div>{/* closes tabs container */}
        </div>{/* closes space-y-6 Main Content */}
      </div>{/* closes max-w-7xl stats+content wrapper */}
    </div>/* closes main wrapper */
  );
};

export default LiveTrackingRouteOptimization;

