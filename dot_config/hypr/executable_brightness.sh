#!/bin/bash

case "$1" in
    up)
        ddcutil setvcp 10 + 10
        ;;
    down)
        ddcutil setvcp 10 - 10
        ;;
esac

# Get current brightness and show notification
current=$(ddcutil getvcp 10 | grep -o 'current value = *[0-9]*' | grep -o '[0-9]*')
notify-send -t 1000 "Brightness" "${current}%"