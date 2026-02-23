import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, CheckCircle, XCircle, Download } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminParticipants = () => {
  const { id } = useParams();
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParticipants();
  }, [id]);

  const fetchParticipants = async () => {
    try {
      const response = await axios.get(`${API}/admin/events/${id}/participants`, {
        headers: getAuthHeaders()
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    
    const headers = ['Nom', 'Téléphone', 'Statut', 'Date d\'achat'];
    const rows = data.participants.map(p => [
      p.holder_name || 'N/A',
      p.phone_number || 'N/A',
      p.is_used ? 'Utilisé' : 'Valide',
      new Date(p.purchase_date).toLocaleDateString('fr-FR')
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Événement non trouvé</p>
        <Link to="/admin/events" className="text-primary hover:underline">
          Retour aux événements
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/events"
          className="p-2 glass rounded-full"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-unbounded font-bold text-2xl text-white">
            Liste des Participants
          </h1>
          <p className="text-gray-400">{data.total_participants} participant(s)</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

      {/* Participants Table */}
      <div className="glass-card overflow-hidden">
        {data.participants.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400">Aucun participant pour cet événement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Téléphone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Date d'achat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.participants.map((participant, index) => (
                  <tr key={participant.ticket_id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white font-medium">
                        {participant.holder_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-300 font-mono">
                        {participant.phone_number || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {participant.is_used ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-600/20 text-gray-400">
                          <CheckCircle size={12} />
                          Utilisé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                          <CheckCircle size={12} />
                          Valide
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {new Date(participant.purchase_date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminParticipants;
