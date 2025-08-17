import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Invites() {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [invites, setInvites] = useState({ received: [], sent: [] });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get('/users');
        setUsers(res.data);
        const map = {};
        res.data.forEach((u) => {
          map[u.id] = u.name;
        });
        setUserMap(map);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching users');
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [api]);

  const fetchInvites = async () => {
    try {
      const res = await api.get('/invites');
      setInvites(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching invites');
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [api]);

  const sendInvite = async (receiverId) => {
    try {
      await api.post('/invites', { receiver_id: receiverId });
      fetchInvites();
      alert('Invite sent!');
    } catch (err) {
      alert(err.response?.data?.message || 'Error sending invite');
    }
  };

  const acceptInvite = async (inviteId) => {
    try {
      await api.post(`/invites/${inviteId}/accept`);
      fetchInvites();
      alert('Invite accepted! Battle started');
    } catch (err) {
      alert(err.response?.data?.message || 'Error accepting invite');
    }
  };

  const rejectInvite = async (inviteId) => {
    try {
      await api.post(`/invites/${inviteId}/reject`);
      fetchInvites();
      alert('Invite rejected');
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting invite');
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Invites & Rivals</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ marginBottom: '1rem' }}>
        <h3>All Players</h3>
        {loadingUsers ? (
          <p>Loading users...</p>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u.id} style={{ marginBottom: '0.5rem' }}>
                {u.name} ({u.email})
                <button onClick={() => sendInvite(u.id)} style={{ marginLeft: '0.5rem' }}>Invite</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Invites Received</h3>
        {loadingInvites ? (
          <p>Loading invites...</p>
        ) : invites.received.length === 0 ? (
          <p>No invites</p>
        ) : (
          <ul>
            {invites.received.map((inv) => {
              const senderName = userMap[inv.sender_id] || `User #${inv.sender_id}`;
              return (
                <li key={inv.id} style={{ marginBottom: '0.5rem' }}>
                  From {senderName}
                  <button onClick={() => acceptInvite(inv.id)} style={{ marginLeft: '0.5rem' }}>Accept</button>
                  <button onClick={() => rejectInvite(inv.id)} style={{ marginLeft: '0.5rem' }}>Reject</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <h3>Invites Sent</h3>
        {loadingInvites ? (
          <p>Loading invites...</p>
        ) : invites.sent.length === 0 ? (
          <p>No sent invites</p>
        ) : (
          <ul>
            {invites.sent.map((inv) => {
              const receiverName = userMap[inv.receiver_id] || `User #${inv.receiver_id}`;
              return (
                <li key={inv.id} style={{ marginBottom: '0.5rem' }}>
                  To {receiverName} (pending)
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}