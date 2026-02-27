import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Download, Users, Mail, Phone, Ticket, Filter, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrganizerParticipants = () => {
  const { getAuthHeaders } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchParticipants();
  }, [selectedEvent, search]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/organizer/events`, {
        headers: getAuthHeaders()
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      let url = `${API}/organizer/participants`;
      const params = new URLSearchParams();
      if (selectedEvent && selectedEvent !== 'all') {
        params.append('event_id', selectedEvent);
      }
      if (search) {
        params.append('search', search);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, {
        headers: getAuthHeaders()
      });
      setParticipants(response.data.participants);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let url = `${API}/organizer/participants/export`;
      if (selectedEvent && selectedEvent !== 'all') {
        url += `?event_id=${selectedEvent}`;
      }

      const response = await axios.get(url, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `participants-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Export réussi!');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl text-white">Liste des Participants</h1>
          <p className="text-gray-400">{total} participant(s) au total</p>
        </div>
        <Button 
          onClick={handleExport} 
          disabled={exporting || participants.length === 0}
          className="bg-green-500 hover:bg-green-600 text-black gap-2"
          data-testid="export-btn"
        >
          <Download size={18} />
          {exporting ? 'Export...' : 'Exporter CSV'}
        </Button>
      </div>

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, téléphone..."
              className="pl-10 bg-white/5 border-white/10 text-white"
              data-testid="search-input"
            />
          </div>
          
          {/* Event Filter */}
          <div className="w-full sm:w-64">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="bg-white/5 border-white/10">
                <Filter size={16} className="mr-2 text-gray-400" />
                <SelectValue placeholder="Tous les événements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les événements</SelectItem>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Participants List */}
      {loading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : participants.length === 0 ? (
        <div className="glass p-12 rounded-xl text-center">
          <Users className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400 text-lg">Aucun participant trouvé</p>
          <p className="text-gray-500 text-sm mt-2">
            {search ? 'Essayez une autre recherche' : 'Les acheteurs apparaîtront ici'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {participants.map((participant, index) => (
            <div 
              key={participant.ticket_id} 
              className="glass p-4 rounded-xl"
              data-testid={`participant-${index}`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Avatar & Name */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-black font-bold text-lg">
                    {participant.buyer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{participant.buyer_name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      {participant.buyer_email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} />
                          {participant.buyer_email}
                        </span>
                      )}
                      {participant.buyer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {participant.buyer_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Event Info */}
                <div className="flex-1">
                  <p className="text-gray-300 text-sm">{participant.event_title}</p>
                  <p className="text-gray-500 text-xs">{participant.event_date}</p>
                </div>

                {/* Ticket Info */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Ticket size={14} className="text-cyan-400" />
                      <span className="text-white text-sm">{participant.ticket_type}</span>
                    </div>
                    <p className="text-green-400 font-mono text-sm">{formatPrice(participant.price)}</p>
                  </div>
                  
                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1
                    ${participant.status === 'used' 
                      ? 'bg-gray-500/20 text-gray-400' 
                      : 'bg-green-500/20 text-green-400'}`}
                  >
                    {participant.status === 'used' ? (
                      <>
                        <CheckCircle size={12} />
                        Utilisé
                      </>
                    ) : (
                      <>
                        <Clock size={12} />
                        Valide
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ID Document (for transport) */}
              {participant.passenger_id && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-500">
                  ID Document: {participant.passenger_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {participants.length > 0 && (
        <div className="glass p-4 rounded-xl">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total affiché:</span>
              <span className="text-white ml-2 font-mono">{participants.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Billets utilisés:</span>
              <span className="text-white ml-2 font-mono">
                {participants.filter(p => p.status === 'used').length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Billets valides:</span>
              <span className="text-green-400 ml-2 font-mono">
                {participants.filter(p => p.status === 'valid').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerParticipants;
