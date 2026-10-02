import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostCard } from './PostCard';
import { fetchFeedBySocialGraph, togglePostLike } from '../services/feedApi';
import type { Post } from '../types/post.types';

vi.mock('../services/feedApi', () => ({
  fetchFeedBySocialGraph: vi.fn(),
  togglePostLike: vi.fn(),
  submitPost: vi.fn(),
}));

const feedMock = vi.mocked(fetchFeedBySocialGraph);
const likeMock = vi.mocked(togglePostLike);

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-1',
    texto: 'Hola red, primer post',
    fechaCreacion: Date.now() - 5 * 60_000,
    autorId: 'u-2',
    autorUsername: 'beatriz',
    totalLikes: 5,
    likedByMe: false,
    ...overrides,
  };
}

describe('PostCard', () => {
  beforeEach(() => {
    feedMock.mockReset();
    likeMock.mockReset();
    likeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('like sin refetch', () => {
    it('actualiza el contador en el lugar sin volver a pedir el feed', async () => {
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patino" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(likeMock).toHaveBeenCalledTimes(1);
      expect(likeMock).toHaveBeenCalledWith('p-1', 'carlos-patino');
      expect(await screen.findByRole('button', { name: '6' })).toBeInTheDocument();
      expect(feedMock).not.toHaveBeenCalled();
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });

    it('revierte el contador y registra el error cuando el like falla', async () => {
      likeMock.mockRejectedValue(new Error('error de red'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<PostCard post={post()} currentUserId="carlos-patio" />);

      await user.click(screen.getByRole('button', { name: '5' }));

      expect(await screen.findByRole('button', { name: '5' })).toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Hola red, primer post')).toBeInTheDocument();
    });
  });
});
