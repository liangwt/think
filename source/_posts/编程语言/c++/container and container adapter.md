---
title: "STL Container and Container Adaptor Classes: A Summary"
date: 2020/09/06 19:57:25
categories:
- 编程语言 / C++
tags:
- c++
- STL
- Container
toc: true

---

This page lists the STL container and container adaptor class types. These are all template classes that provide containers for holding and manipulating elements of any user-chosen or user-defined type.

The term *first-class container*, when applied to a container type, simply means that the container class has all the characteristics and behaviors that a user would expect of any data type, given the user's previous experience (with built-in data types, for example). The first-class containers include the `vector`, `deque`, `list`, `map`, `multimap`, `set`, and `multiset` classes.

The term *container adaptor*, on the other hand refers to an "adaptation" of one of the first-class containers by modifying and restricting its interface for some special purpose. These container adaptors include the `stack` and `queue`, which are based (by default) on the `deque`, as well as the `priority_queue`, which is based (by default) on the `vector`.

<!--more-->

## First-class containers

### Sequence Containers

Here are the sequence containers, meaning the data is reliably ordered (that is, there is a front and a back to them. I do NOT mean that they automatically sort themselves!).

- A **vector** is a bit like a flexibly-sized array. Vectors are random-access, meaning you can access any element with integer index in constant time (just like an array). You can add or remove from the back of the vector in amortized constant time as well. Anywhere else, though, and you're probably looking at having to recopy potentially all of the elements.
- A **deque**, or double-ended queue, is like a vector but you can add to the front or the back in amortized constant time. You can still access elements in constant time, but deque elements are not guaranteed to be contiguous in memory like vectors or arrays.
- A **list** is a linked list, meaning data which are linked together by pointers. You have constant-time access to the beginning and the end, but in order to get anywhere in the middle you need to iterate through the list. You can add elements anywhere in the list in constant time, though, if you already have a pointer to one of the nearby nodes.

### Associative Containers

Associative containers implement sorted data structures that can be quickly searched (***O(log n)*** complexity).

- **set**: collection of unique keys, sorted by keys. A **set** is a container with unique elements. You can only add one of each element to a set; any other additions are ignored.
- A **multiset** is like a set, but you can put more than one of an element in. The multiset keeps track of how many of each kind of element are in the structure.
- **map**: collection of key-value pairs, sorted by keys, keys are unique. A **map**, also known as an associative array, is a structure in which you insert key-value pairs; then you can look up any value by supplying the key. So it's a bit like an array that you can access with a string index (key), or any other kind of index. (If you insert another key-value pair and the key already exists, then you just overwrite the value for the original key.)
- A **multimap** is a map that allows for insertion of multiple values for the same key. When you do a key lookup, you get back a container with all the values in it.

### Unordered associative containers

Unordered associative containers implement unsorted (hashed) data structures that can be quickly searched (***O(1)*** amortized, ***O(n)*** worst-case complexity).

- **unordered_set**(C++11): collection of unique keys, hashed by keys
- **unordered_multiset**(C++11): collection of keys, hashed by keys
- **unordered_map**(C++11): collection of key-value pairs, hashed by keys, keys are unique
- **unordered_multimap**(C++11): collection of key-value pairs, hashed by keys

## Container Adapters

Container adapters, on the other hand, are interfaces created by limiting functionality in a pre-existing container and providing a different set of functionality. When you declare the container adapters, you have an option of specifying which sequence containers form the underlying container. These are:

- A **stack** is a container providing Last-In, First-Out (LIFO) access. Basically, you remove elements in the reverse order you insert them. It's difficult to get to any elements in the middle. Usually this goes on top of a *deque*.
- A **queue** is a container providing First-In, First-Out (FIFO) access. You remove elements in the same order you insert them. It's difficult to get to any elements in the middle. Usually this goes on top of a *deque*.
- A **priority_queue** is a container providing sorted-order access to elements. You can insert elements in any order, and then retrieve the "lowest" of these values at any time. Priority queues in C++ STL use a heap structure internally, which in turn is basically array-backed; thus, usually this goes on top of a *vector*.

## Other (non-STL) classes with STL-like characteristics and behaviors

There are some other classes that are regarded as near-containers, in that (for example) they can be used with iterators, which makes them accessible to manipulation via the STL algorithms.

- string

  Not to be confused with the legacy C-string data type, inherited from the C-language, and consisting of a simple character array with the characters of interest terminated with a null character. The C++ `string` class is indeed a bona fide class, with much more flexibility (and safety) than the older C-string, and should probably be used anywhere the C-string is not explicitly required. (But that's more free advice.)

- bitset

  Provides a model for a fixed-size array of bits or boolean values, which is used to manage a set of "on-off switches" (or "flags") and where the state of a `bitset` object at any time will represent some combination of such flags (or on-off switches).

- valarray

  Provides a representation for the mathematical concept of a linear sequence of values and is designed to permit the efficient performance of certain numerical calculations. That having been said, some writers argue that the `valarray` class is poorly designed and that there are better alternatives if you wish to do serious numerical calculations in C++.

Note that for many purposes even "ordinary" C-style arrays (which are not classes) and C-strings (which are also not classes) can be accessed from the STL with C-style pointers in the same way that STL containers are accessed with STL iterators.

## Member function table

![Member function table](https://cdn.showthink.cn/img/ttt.jpg)

