import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Ticket, Calendar, Clock, MapPin, ChevronRight, Filter, Train, Ship } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MyTicketsPage = () => {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`, {
        headers: getAuthHeaders()
      });
      setTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const filteredTickets = tickets.filter(ticket => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'valid') return ticket.status === 'valid';
    if (statusFilter === 'used') return ticket.status === 'used';
    return true;
  });

  // Group tickets by event date
  const groupedTickets = filteredTickets.reduce((groups, ticket) => {
    const date = ticket.event_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(ticket);
    return groups;
  }, {});

  const getTicketIcon = (ticket) => {
    if (ticket.type === 'train') return Train;
    if (ticket.type === 'ferry') return Ship;
    return Ticket;
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white">
            Mes Billets
          </h1>
          <span className="text-gray-400">{tickets.length} billet(s)</span>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 glass border-white/10" data-testid="status-filter">
              <Filter size={18} className="mr-2" />
              <SelectValue placeholder="Filtrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les billets</SelectItem>
              <SelectItem value="valid">Valides</SelectItem>
              <SelectItem value="used">Utilisés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {filteredTickets.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <Ticket className="mx-auto text-gray-500 mb-6" size={64} />
            <h2 className="font-unbounded font-bold text-2xl text-white mb-3">
              {tickets.length === 0 ? 'Aucun billet' : 'Aucun résultat'}
            </h2>
            <p className="text-gray-400 mb-6">
              {tickets.length === 0 
                ? "Vous n'avez pas encore acheté de billets"
                : "Aucun billet ne correspond à ce filtre"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTickets)
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .map(([date, dateTickets]) => (
                <div key={date}>
                  <h3 className="font-unbounded font-semibold text-lg text-white mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-green-400" />
                    {new Date(date).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h3>
                  <div className="space-y-3">
                    {dateTickets.map((ticket) => {
                      const TicketIcon = getTicketIcon(ticket);
                      return (
                        <button
                          key={ticket.id}
                          onClick={() => navigate(`/ticket/${ticket.id}`)}
                          className="w-full glass p-4 rounded-xl flex items-center gap-4 hover:border-green-500/30 transition-all text-left border border-white/10"
                          data-testid={`ticket-${ticket.id}`}
                        >
                          {/* Status Indicator */}
                          <div className={`w-2 h-16 rounded-full ${
                            ticket.status === 'used' ? 'bg-gray-500' : 'bg-green-500'
                          }`} />

                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            ticket.type === 'train' ? 'bg-train/20' : 
                            ticket.type === 'ferry' ? 'bg-ferry/20' : 'bg-green-500/20'
                          }`}>
                            <TicketIcon className={
                              ticket.type === 'train' ? 'text-train' : 
                              ticket.type === 'ferry' ? 'text-ferry' : 'text-green-400'
                            } size={20} />
                          </div>

                          {/* Ticket Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-unbounded font-semibold text-white truncate">
                                {ticket.event_title}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                                ${ticket.status === 'used' ? 'bg-gray-600 text-gray-300' : 'bg-green-500/20 text-green-400'}`}>
                                {ticket.status === 'used' ? 'Utilisé' : 'Valide'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {ticket.event_time}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {ticket.event_venue}
                              </span>
                            </div>
                            {ticket.passenger_name && (
                              <p className="text-xs text-gray-500 mt-1">
                                Passager: {ticket.passenger_name}
                              </p>
                            )}
                          </div>

                          {/* Price & Arrow */}
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="font-mono font-bold text-green-400">
                                {formatPrice(ticket.price)}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {ticket.id.slice(0, 8)}...
                              </p>
                            </div>
                            <ChevronRight className="text-gray-500" size={20} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketsPage;
