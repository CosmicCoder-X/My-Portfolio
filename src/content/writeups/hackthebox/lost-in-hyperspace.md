---
title: 'Lost in Hyperspace'
target: 'Hack The Box — Lost in Hyperspace'
difficulty: 'medium'
date: 2025-08-29
summary: 'An AI/ML challenge — PCA reduction of high-dimensional token embeddings to 3D reveals a deliberate spiral in the XY projection, with the flag readable from labeled characters along the spiral path.'
role: 'llm'
tags: ['ai', 'machine-learning', 'embeddings', 'pca', 'dimensionality-reduction', 'numpy', 'matplotlib', 'scikit-learn', 'nlp', 'tokenization']
problem: 'Two .npy files — high-dimensional embedding vectors and corresponding single-character tokens. The hint references shadows of higher-dimensional objects. The flag is encoded in the spatial arrangement of embeddings when projected to lower dimensions.'
action: 'Loaded both .npy files in Google Colab. Applied PCA (scikit-learn) to reduce embeddings to 3 components and plotted with 2D projections onto XY, XZ, and YZ planes. The XY projection showed an unnaturally clean spiral pattern. Added token labels to each projected point, revealing the flag spelled out along the spiral path.'
outcome: 'The flag was retrieved by reading the token characters in order along the spiral pattern visible in the XY plane projection. The solve required understanding embeddings and dimensionality reduction, recognising that the spiral was deliberately encoded into the embedding vectors, and labeling the projected points with their corresponding tokens to read the hidden message.'
draft: false
---

## Background

Lost in Hyperspace is a refreshingly different kind of challenge — an AI/ML problem that doesn't involve chatbots or prompt injection. Instead, it's about understanding how embeddings work and using dimensionality reduction to reveal a message hidden in high-dimensional vector space. The challenge description — "A cube is the shadow of a tesseract casted on 3 dimensions. I wonder what other secrets may the shadows hold" — is the key hint: project the data down to lower dimensions and look at the shadows.

---

## The data

The challenge provides two `.npy` files — NumPy binary arrays. Loading them in Google Colab with `np.load` reveals what we're working with.

`embeddings.npy` contains a matrix of high-dimensional floating-point vectors — each row is a vector with many dimensions, values ranging roughly from -1 to +1.

`tokens.npy` contains an array of individual characters — letters, digits, underscores, braces, and punctuation — each stored as a single Unicode character. These are the building blocks of the flag, but in their current order they're scrambled and unreadable.

![Google Colab notebook showing import numpy as np, then np.load on embeddings.npy displaying a matrix of floating-point vectors with values like -0.38804208 and 0.84272571, and np.load on tokens.npy displaying an array of individual characters including T, L, E, T, F, L, 1, E, Y, W, T, V, 3, opening brace, B, 8 and many more, with dtype U1.](/writeups/htb-lost-in-hyperspace/01-numpy-arrays.png)

Each token corresponds to one embedding vector — the i-th character in `tokens.npy` has its embedding at the i-th row of `embeddings.npy`. The vectors encode positional information about where each character should appear when projected into lower dimensions, but in their native high-dimensional space that structure isn't visible.

---

## Dimensionality reduction with PCA

The challenge description hints at 3D and shadows, so the approach is to reduce the embedding dimensions down to 3 using **PCA** (Principal Component Analysis) from scikit-learn. PCA finds the axes of maximum variance in the data and projects everything onto them — it's the standard technique for making high-dimensional data visually interpretable.

After reducing to 3 components, plotting the vectors as a 3D scatter plot with 2D shadow projections onto the three planes (XY, XZ, YZ) reveals something striking — the **XY plane shadow** contains an unnaturally clean spiral pattern. The 3D points look scattered, the XZ and YZ shadows look noisy, but the XY projection has a structure that's too deliberate to be coincidence.

![3D PCA plot titled 3D PCA Plot with 2D Projections showing blue dots scattered in 3D space with three 2D shadow projections — red XY Shadow dots on the floor plane forming a visible spiral pattern, green XZ Shadow dots on the side wall, and orange YZ Shadow dots on the back wall. Axes labeled Principal Component 1, 2, and 3.](/writeups/htb-lost-in-hyperspace/02-pca-3d-plot.png)

The spiral is the signal. The embedding vectors were deliberately constructed so that when reduced to 3D via PCA, their XY projection would arrange certain points along a spiral path.

---

## Reading the flag from the spiral

The next step is adding the token characters as labels to each projected point. Re-running the plot with text annotations — placing each token's character next to its corresponding dot in all three projections — turns the spiral from an abstract pattern into readable text. The characters along the XY spiral spell out the flag in order.

The PCA and plotting code uses scikit-learn for dimensionality reduction and matplotlib for the 3D visualisation:

```python
import numpy as np
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

embeddings = np.load('embeddings.npy')
tokens = np.load('tokens.npy')

pca = PCA(n_components=3)
embeddings_3d = pca.fit_transform(embeddings)

x = embeddings_3d[:, 0]
y = embeddings_3d[:, 1]
z = embeddings_3d[:, 2]

fig = plt.figure(figsize=(12, 12))
ax = fig.add_subplot(111, projection='3d')

ax.scatter(x, y, z, c='b', marker='o', s=50, alpha=0.6, label='3D Points')

x_min, y_min, z_min = x.min(), y.min(), z.min()

# XY-plane shadow with labels
ax.scatter(x, y, z_min, c='r', marker='o', s=10, alpha=0.3)
for i in range(len(tokens)):
    ax.text(x[i], y[i], z_min, tokens[i], color='r', fontsize=8)

# XZ-plane shadow with labels
ax.scatter(x, y_min, z, c='g', marker='o', s=10, alpha=0.3)
for i in range(len(tokens)):
    ax.text(x[i], y_min, z[i], tokens[i], color='g', fontsize=8)

# YZ-plane shadow with labels
ax.scatter(x_min, y, z, c='orange', marker='o', s=10, alpha=0.3)
for i in range(len(tokens)):
    ax.text(x_min, y[i], z[i], tokens[i], color='orange', fontsize=8)

ax.set_xlabel('Principal Component 1')
ax.set_ylabel('Principal Component 2')
ax.set_zlabel('Principal Component 3')
ax.set_title('3D PCA Plot with 2D Projections and Labels')
plt.savefig('3d_pca_with_shadows_and_labels.png')
```

With the labels rendered, the flag was readable along the spiral path in the XY projection.

---

## What I took from this

This is one of the more creative challenge designs I've come across — encoding a message not in the data itself but in the geometric structure that emerges when the data is projected into lower dimensions. The tokens array in its native order is meaningless, and the embeddings array is a wall of floating-point numbers. The flag only becomes visible through the specific transformation of PCA reduction followed by 2D projection.

The concept behind the challenge is grounded in real ML fundamentals. In natural language processing, embeddings map tokens to high-dimensional vector spaces where relationships between tokens are encoded as geometric properties — similar words cluster together, analogies appear as vector arithmetic, and structure in the embedding space reflects structure in meaning. This challenge inverts that principle: instead of the embeddings encoding semantic relationships, they encode a spatial message that's only readable when projected down.

PCA is worth understanding beyond just this challenge. It's the most common dimensionality reduction technique in data science and ML, used for everything from visualising high-dimensional datasets to noise reduction to feature extraction. The core idea — finding the directions of maximum variance and projecting onto them — means that PCA preserves the most "interesting" structure in the data while discarding the noise. In this challenge, the "interesting" structure was a deliberate spiral encoding the flag, and PCA reliably recovered it because the spiral's variance dominated the random noise in the other dimensions.

The challenge description's analogy is precise: a cube is a 3D shadow of a 4D tesseract, and projecting high-dimensional embeddings down to 2D reveals a shadow that contains information invisible in the original space. The same principle applies in reverse — when working with ML embeddings in practice, visualising them through t-SNE or PCA projections often reveals clustering, outliers, and structure that isn't apparent from the raw numbers. This challenge turns that analytical technique into a puzzle.
