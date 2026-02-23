import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, Ticket } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeFromCart, loading } = useCart();

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const handleRemove = async (eventId, title) => {
    try {
      await removeFromCart(eventId);
      toast.success(`${title} retiré du panier`);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-green-400 font-unbounded">Chargement...</div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass p-12 rounded-2xl text-center max-w-md">
          <ShoppingBag className="mx-auto text-gray-500 mb-6" size={64} />
          <h2 className="font-unbounded font-bold text-2xl text-white mb-3">Panier vide</h2>
          <p className="text-gray-400 mb-6">
            Vous n'avez pas encore ajouté de billets à votre panier
          </p>
          <Button 
            onClick={() => navigate('/')} 
            className="bg-green-500 hover:bg-green-600 text-black" 
            data-testid="browse-events-btn"
          >
            Parcourir les événements
          </Button>
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
            Votre Panier
          </h1>
          <span className="text-gray-400">
            {cart.items.reduce((sum, item) => sum + item.quantity, 0)} article(s)
          </span>
        </div>

        {/* Cart Items */}
        <div className="space-y-4 mb-8">
          {cart.items.map((item) => (
            <div
              key={item.event_id}
              className="glass p-4 rounded-xl flex gap-4"
              data-testid={`cart-item-${item.event_id}`}
            >
              {/* Image */}
              <img
                src={item.event?.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&q=85'}
                alt={item.event?.title}
                className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover"
              />

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-unbounded font-semibold text-white text-lg truncate">
                  {item.event?.title}
                </h3>
                <p className="text-gray-400 text-sm mb-2">
                  {item.event?.date}
                </p>
                <p className="text-gray-400 text-sm mb-2">
                  {item.event?.venue}
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-white font-mono font-medium">
                    {item.quantity} × {formatPrice(item.event?.price || 0)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end justify-between">
                <button
                  onClick={() => handleRemove(item.event_id, item.event?.title)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  data-testid={`remove-item-${item.event_id}`}
                >
                  <Trash2 size={20} />
                </button>
                <p className="font-mono font-bold text-white text-lg">
                  {formatPrice(item.subtotal || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="glass p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Sous-total</span>
            <span className="text-white font-mono font-medium">{formatPrice(cart.total)}</span>
          </div>
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
            <span className="text-gray-400">Frais de service</span>
            <span className="text-green-400 font-medium">Gratuit</span>
          </div>
          <div className="flex items-center justify-between mb-6">
            <span className="font-unbounded font-bold text-xl text-white">Total</span>
            <span className="font-mono font-bold text-2xl text-green-400" data-testid="cart-total">
              {formatPrice(cart.total)}
            </span>
          </div>
          <Button
            onClick={() => navigate('/checkout')}
            className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-black gap-2"
            data-testid="checkout-btn"
          >
            <Ticket size={20} />
            Procéder au paiement
            <ArrowRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
