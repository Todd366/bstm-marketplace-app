import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, Package, ShoppingCart, DollarSign, Users, Star, MessageSquare, Settings, Eye, Heart, ArrowUp, ArrowDown } from 'lucide-react';

const salesData = [
  { month: 'Jan', revenue: 12400, orders: 45, visitors: 890 },
  { month: 'Feb', revenue: 15600, orders: 52, visitors: 1050 },
  { month: 'Mar', revenue: 18900, orders: 68, visitors: 1340 },
  { month: 'Apr', revenue: 16200, orders: 58, visitors: 1120 },
  { month: 'May', revenue: 21500, orders: 75, visitors: 1580 },
  { month: 'Jun', revenue: 24300, orders: 89, visitors: 1820 },
];

const categoryData = [
  { name: 'Electronics', value: 35, color: '#667eea' },
  { name: 'Fashion', value: 25, color: '#ec4899' },
  { name: 'Home & Garden', value: 20, color: '#10b981' },
  { name: 'Vehicles', value: 15, color: '#ef4444' },
  { name: 'Other', value: 5, color: '#f59e0b' },
];

const recentOrders = [
  { id: '#BSTM-1234', product: 'iPhone 13 Pro', buyer: 'Mpho K.', amount: 4500, status: 'paid', location: 'Gaborone', image: '/api/placeholder/60/60', date: '2025-11-28' },
  { id: '#BSTM-1235', product: 'Leather Sofa', buyer: 'Lesego M.', amount: 6200, status: 'pending', location: 'Maun', image: '/api/placeholder/60/60', date: '2025-11-27' },
  { id: '#BSTM-1236', product: 'Photography Service', buyer: 'Tebogo R.', amount: 800, status: 'completed', location: 'Francistown', image: '/api/placeholder/60/60', date: '2025-11-26' },
  { id: '#BSTM-1237', product: 'Samsung TV 55"', buyer: 'Kabo S.', amount: 3200, status: 'shipped', location: 'Molepolole', image: '/api/placeholder/60/60', date: '2025-11-25' },
  { id: '#BSTM-1238', product: 'Office Chair', buyer: 'Neo P.', amount: 850, status: 'paid', location: 'Gaborone', image: '/api/placeholder/60/60', date: '2025-11-24' },
];

const topProducts = [
  { name: 'iPhone 13 Pro', sales: 24, revenue: 108000, trend: 'up', image: '/api/placeholder/80/80' },
  { name: 'Toyota Hilux', sales: 3, revenue: 585000, trend: 'up', image: '/api/placeholder/80/80' },
  { name: 'Leather Sofa', sales: 12, revenue: 74400, trend: 'down', image: '/api/placeholder/80/80' },
  { name: 'Samsung TV', sales: 18, revenue: 57600, trend: 'up', image: '/api/placeholder/80/80' },
];

const messages = [
  { id: 1, user: 'Mpho Kgosi', message: 'Is the iPhone still available?', time: '5 min ago', unread: true, avatar: '/api/placeholder/40/40' },
  { id: 2, user: 'Lesego Moabi', message: 'Can you deliver to Maun?', time: '15 min ago', unread: true, avatar: '/api/placeholder/40/40' },
  { id: 3, user: 'Tebogo Seretse', message: 'Thank you for the quick service!', time: '1 hour ago', unread: false, avatar: '/api/placeholder/40/40' },
];

const BSTMDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('6months');

  const StatCard = ({ title, value, change, icon: Icon, color, prefix = '', suffix = '' }) => (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${color}`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className={`flex items-center text-sm font-semibold px-3 py-1 rounded-full ${
          change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {change >= 0 ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
          {Math.abs(change)}%
        </div>
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-800">{prefix}{value.toLocaleString()}{suffix}</p>
      <p className="text-xs text-gray-500 mt-2">vs last month</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xl">B</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">BSTM Seller Hub</h1>
                <p className="text-sm text-purple-100">Manage your marketplace presence</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="relative">
                <MessageSquare className="w-6 h-6 cursor-pointer hover:opacity-80" />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
              </div>
              <div className="relative">
                <span className="w-10 h-10 bg-purple-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-800">
                  <Users className="w-5 h-5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-wrap gap-4">
            <button className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Add New Product</span>
            </button>
            <button className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Messages (3)</span>
            </button>
            <button className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={109000}
            change={12.5}
            icon={DollarSign}
            color="from-purple-500 to-purple-700"
            suffix=" BWP"
          />
          <StatCard
            title="Total Orders"
            value={387}
            change={8.2}
            icon={ShoppingCart}
            color="from-blue-500 to-blue-700"
          />
          <StatCard
            title="Active Products"
            value={24}
            change={-2.3}
            icon={Package}
            color="from-green-500 to-green-700"
          />
          <StatCard
            title="Store Rating"
            value={4.8}
            change={3.1}
            icon={Star}
            color="from-yellow-500 to-orange-600"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-8">
          <div className="border-b border-gray-200 px-6">
            <nav className="flex space-x-8">
              {['overview', 'orders', 'products', 'analytics', 'messages'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-2 border-b-3 font-semibold text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Revenue Chart */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1">Revenue Overview</h3>
                      <p className="text-sm text-gray-600">Your sales performance over time</p>
                    </div>
                    <select 
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="6months">Last 6 Months</option>
                      <option value="3months">Last 3 Months</option>
                      <option value="1year">Last Year</option>
                    </select>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={salesData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#667eea" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#667eea" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Category Distribution */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Sales by Category</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Products */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-6">Top Performing Products</h3>
                    <div className="space-y-4">
                      {topProducts.map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-4">
                            <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                              <p className="font-semibold text-gray-800">{product.name}</p>
                              <p className="text-sm text-gray-600">{product.sales} sales</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">{product.revenue.toLocaleString()} BWP</p>
                            <div className={`flex items-center text-sm ${product.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                              {product.trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                              Trending
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Orders Trend */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Order Volume Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px'
                        }}
                      />
                      <Bar dataKey="orders" fill="#667eea" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Recent Orders</h3>
                  <div className="flex space-x-2">
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">All</button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">Pending</button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">Completed</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">{order.id}</span>
                            <p className="text-xs text-gray-500">{order.date}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <img src={order.image} alt="" className="w-10 h-10 rounded-lg mr-3" />
                              <span className="text-sm font-medium text-gray-900">{order.product}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.buyer}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-gray-900">{order.amount.toLocaleString()} BWP</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.status === 'completed' ? 'bg-green-100 text-green-800' :
                              order.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-purple-600 hover:text-purple-800 font-semibold">
                              View Details →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">My Products</h3>
                  <button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all">
                    + Add New Product
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-purple-300 hover:shadow-xl transition-all">
                      <div className="relative">
                        <img src="/api/placeholder/400/300" alt="Product" className="w-full h-48 object-cover" />
                        <div className="absolute top-3 right-3 space-y-2">
                          <button className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50">
                            <Heart className="w-5 h-5 text-red-500" />
                          </button>
                          <button className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50">
                            <Eye className="w-5 h-5 text-blue-500" />
                          </button>
                        </div>
                        <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Active
                        </span>
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-lg text-gray-800 mb-2">iPhone 13 Pro</h3>
                        <p className="text-sm text-gray-600 mb-4">256GB, Pacific Blue, Excellent condition</p>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl font-bold text-purple-600">6,500 BWP</span>
                          <div className="flex items-center text-sm text-gray-600">
                            <Eye className="w-4 h-4 mr-1" />
                            <span>124 views</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
                            Edit
                          </button>
                          <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-gray-50 rounded-2xl p-4">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Recent Messages</h3>
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`p-4 rounded-xl cursor-pointer transition-all ${msg.unread ? 'bg-purple-50 border-2 border-purple-200' : 'bg-white hover:bg-gray-100'}`}>
                        <div className="flex items-center space-x-3">
                          <img src={msg.avatar} alt="" className="w-10 h-10 rounded-full" />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-gray-800 text-sm">{msg.user}</p>
                              <span className="text-xs text-gray-500">{msg.time}</span>
                            </div>
                            <p className="text-sm text-gray-600 truncate">{msg.message}</p>
                          </div>
                          {msg.unread && <div className="w-2 h-2 bg-purple-600 rounded-full"></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
                  <div className="text-center py-20">
                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Select a conversation to view messages</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-6 hover:shadow-2xl transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="w-10 h-10 opacity-80" />
              <span className="text-3xl font-bold">3</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Unread Messages</h3>
            <p className="text-purple-100 text-sm">Respond quickly to buyers</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-6 hover:shadow-2xl transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Package className="w-10 h-10 opacity-80" />
              <span className="text-3xl font-bold">6</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Pending Reviews</h3>
            <p className="text-blue-100 text-sm">Products awaiting approval</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-2xl p-6 hover:shadow-2xl transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Star className="w-10 h-10 opacity-80" />
              <span className="text-3xl font-bold">4.8</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Your Rating</h3>
            <p className="text-green-100 text-sm">Based on 156 reviews</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BSTMDashboard;
